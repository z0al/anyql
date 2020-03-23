// Ours
import {
	Operation,
	$fetch,
	$cancel,
	$dispose,
} from './utils/operations';
import { pipe } from './utils/pipe';
import { Request } from './request';
import { Emitter } from './utils/emitter';
import { transition, State } from './utils/state';
import { createFetch, FetchHandler } from './fetch';
import { Exchange, EmitFunc, ExchangeOptions } from './utils/types';

export interface GCOptions {
	// Max age for inactive queries. Default is 30 seconds.
	maxAge?: number;
}

export interface ClientOptions {
	handler: FetchHandler;
	gc?: GCOptions;
	exchanges?: Array<Exchange>;
}

export type Subscriber = (state: State, data: any, err?: any) => void;

export class Client {
	// Pass operation to exchanges
	private pipeThrough: EmitFunc;

	// A simple key-value cache. It uses the request ID as a key.
	private cacheMap: Partial<Map<string, any>>;

	// Holds the state of all requests.
	private stateMap = new Map<string, State>();

	// We rely on this emitter for everything. In fact, Client is just
	// a wrapper around this.
	private events = Emitter(this.dispose.bind(this));

	// Keeps track of inactive queries (i.e. no subscribers) so they
	// can be disposed later (see .dispose()). The value here is the
	// value returned by `setTimeout()`.
	private inactiveMap = new Map<string, any>();

	constructor(private options: ClientOptions) {
		const exchanges = options.exchanges || [];
		const fetchExchange = createFetch(options.handler);

		const cache: Map<string, any> = new Map();
		this.cacheMap = {
			// Keep refs of the methods we use
			get: cache.get.bind(cache),
			set: cache.set.bind(cache),
			delete: cache.delete.bind(cache),
		};

		// Convert cache into a read-only Map
		cache.set = undefined;
		cache.clear = undefined;
		cache.delete = undefined;

		// Setup exchanges
		const config: ExchangeOptions = {
			emit: this.emit.bind(this),
			cache,
		};

		this.pipeThrough = pipe([...exchanges, fetchExchange], config);
	}

	/**
	 * Extracts request ID
	 *
	 * @param op
	 */
	private key(op: Operation) {
		return op.payload.request.id;
	}

	/**
	 * Emits an event of type `request.id` and `op` as a payload
	 *
	 * @param op
	 */
	private emit(op: Operation) {
		const key = this.key(op);

		// Update cache if necessary
		if (op.type === 'buffer' || op.type === 'complete') {
			if (op.payload.data !== undefined) {
				this.cacheMap.set(key, op.payload.data);
			}
		}

		const next = transition(this.stateMap.get(key), op);

		if (next !== 'disposed') {
			this.stateMap.set(key, next);
			this.events.emit(key, op);
		} else {
			// Clean-up
			this.stateMap.delete(key);
			this.cacheMap.delete(key);
		}
	}

	/**
	 * Compares the next state against the current state and pass
	 * the `op` through the pipeline if necessary.
	 *
	 * @param op
	 */
	private apply(op: Operation) {
		const current = this.stateMap.get(this.key(op));
		const next = transition(current, op);

		// Rule:
		// If it won't change the current state DO NOT do it.
		// The ONLY exception is streaming.
		if (current !== 'streaming' && next === current) {
			return;
		}

		this.pipeThrough(op);
	}

	private dispose(state: string, id: string /* request id */) {
		if (state === 'active') {
			clearTimeout(this.inactiveMap.get(id));
			this.inactiveMap.delete(id);
		}

		if (state === 'inactive') {
			this.inactiveMap.set(
				id,
				setTimeout(() => {
					this.apply($dispose({ id, type: undefined }));
				}, this.options.gc?.maxAge ?? 30 * 1000)
			);
		}
	}

	/**
	 *
	 * @param req
	 * @param cb
	 */
	fetch(req: Request, cb?: Subscriber) {
		const notify = (op: Operation) => {
			const state = this.stateMap.get(req.id) || 'idle';
			const data = this.cacheMap.get(req.id);

			if (op.type === 'reject') {
				return cb(state, data, op.payload.error);
			}

			return cb(state, data);
		};

		if (cb) {
			this.events.on(req.id, notify);
		} else {
			// This is probably a prefetching case. Mark immediately as
			// inactive so that it will be disposed if not used.
			this.dispose('inactive', req.id);
		}

		this.apply($fetch(req));

		return {
			cancel: () => {
				this.apply($cancel(req));
			},
			unsubscribe: () => {
				cb && this.events.off(req.id, notify);
			},
		};
	}

	/**
	 *
	 * @param req
	 */
	prefetch(req: Request) {
		this.fetch(req);
	}
}
