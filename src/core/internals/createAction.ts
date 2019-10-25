/**
 * Copied from https://github.com/reduxjs/redux-starter-kit
 */
import { Action } from 'redux';

// taken from https://github.com/joonhocho/tsdef
// return True if T is `any`, otherwise return False
export type IsAny<T, True, False = never> = (
  | True
  | False) extends (T extends never ? True : False)
  ? True
  : False;

// taken from https://github.com/joonhocho/tsdef
// return True if T is `unknown`, otherwise return False
export type IsUnknown<T, True, False = never> = unknown extends T
  ? IsAny<T, False, True>
  : False;

export type IsEmptyObj<T, True, False = never> = T extends any
  ? keyof T extends never
    ? IsUnknown<T, False, True>
    : False
  : never;

/**
 * returns True if TS version is above 3.5, False if below.
 * uses feature detection to detect TS version >= 3.5
 * * versions below 3.5 will return `{}` for unresolvable interference
 * * versions above will return `unknown`
 * */
export type AtLeastTS35<True, False> = [True, False][IsUnknown<
  ReturnType<<T>() => T>,
  0,
  1
>];

export type IsUnknownOrNonInferrable<T, True, False> = AtLeastTS35<
  IsUnknown<T, True, False>,
  IsEmptyObj<T, True, False>
>;

/**
 * An action with a string type and an associated payload. This is the
 * type of action returned by `createAction()` action creators.
 *
 * @template P The type of the action's payload.
 * @template T the type used for the action type.
 * @template M The type of the action's meta (optional)
 * @template E The type of the action's error (optional)
 */
export type PayloadAction<
  P = void,
  T extends string = string,
  M = void,
  E = void
> = WithOptional<M, E, WithPayload<P, Action<T>>>;

export type PrepareAction<P> =
  | ((...args: any[]) => { payload: P })
  | ((...args: any[]) => { payload: P; meta: any })
  | ((...args: any[]) => { payload: P; meta: any; error: any });

export type ActionCreatorWithPreparedPayload<
  PA extends PrepareAction<any> | void,
  T extends string = string
> = WithTypeProperty<
  T,
  PA extends PrepareAction<infer P>
    ? (
        ...args: Parameters<PA>
      ) => PayloadAction<P, T, MetaOrVoid<PA>, ErrorOrVoid<PA>>
    : void
>;

export type ActionCreatorWithOptionalPayload<
  P,
  T extends string = string
> = WithTypeProperty<
  T,
  {
    (payload?: undefined): PayloadAction<undefined, T>;
    <PT extends Diff<P, undefined>>(payload?: PT): PayloadAction<PT, T>;
  }
>;

export type ActionCreatorWithoutPayload<
  T extends string = string
> = WithTypeProperty<T, () => PayloadAction<undefined, T>>;

export type ActionCreatorWithPayload<
  P,
  T extends string = string
> = WithTypeProperty<
  T,
  IsUnknownOrNonInferrable<
    P,
    // TS < 3.5 infers non-inferrable types to {}, which does not take `null`. This enforces `undefined` instead.
    <PT extends unknown>(payload: PT) => PayloadAction<PT, T>,
    // default behaviour
    <PT extends P>(payload: PT) => PayloadAction<PT, T>
  >
>;

/**
 * An action creator that produces actions with a `payload` attribute.
 */
export type PayloadActionCreator<
  P = void,
  T extends string = string,
  PA extends PrepareAction<P> | void = void
> = IfPrepareActionMethodProvided<
  PA,
  ActionCreatorWithPreparedPayload<PA, T>,
  // else
  IfMaybeUndefined<
    P,
    ActionCreatorWithOptionalPayload<P, T>,
    // else
    IfVoid<
      P,
      ActionCreatorWithoutPayload<T>,
      // else
      ActionCreatorWithPayload<P, T>
    >
  >
>;

/**
 * A utility function to create an action creator for the given action type
 * string. The action creator accepts a single argument, which will be included
 * in the action object as a field called payload. The action creator function
 * will also have its toString() overriden so that it returns the action type,
 * allowing it to be used in reducer logic that is looking for that action type.
 *
 * @param type The action type to use for created actions.
 * @param prepare (optional) a method that takes any number of arguments and returns { payload } or { payload, meta }.
 *                If this is given, the resulting action creator will pass it's arguments to this method to calculate payload & meta.
 */

export function createAction<P = void, T extends string = string>(
  type: T
): PayloadActionCreator<P, T>;

export function createAction<
  PA extends PrepareAction<any>,
  T extends string = string
>(
  type: T,
  prepareAction: PA
): PayloadActionCreator<ReturnType<PA>['payload'], T, PA>;

export function createAction(type: string, prepareAction?: Function) {
  function actionCreator(...args: any[]) {
    if (prepareAction) {
      let prepared = prepareAction(...args);
      if (!prepared) {
        throw new Error('prepareAction did not return an object');
      }

      return {
        type,
        payload: prepared.payload,
        ...('meta' in prepared && { meta: prepared.meta }),
        ...('error' in prepared && { error: prepared.error }),
      };
    }
    return { type, payload: args[0] };
  }

  actionCreator.toString = () => `${type}`;

  actionCreator.type = type;

  return actionCreator;
}

/**
 * Returns the action type of the actions created by the passed
 * `createAction()`-generated action creator (arbitrary action creators
 * are not supported).
 *
 * @param action The action creator whose action type to get.
 * @returns The action type used by the action creator.
 */
export function getType<T extends string>(
  actionCreator: PayloadActionCreator<any, T>
): T {
  return `${actionCreator}` as T;
}

// helper types for more readable typings

type Diff<T, U> = T extends U ? never : T;

type WithPayload<P, T> = T & { payload: P };

type WithOptional<M, E, T> = T &
  ([M] extends [void] ? {} : { meta: M }) &
  ([E] extends [void] ? {} : { error: E });

type WithTypeProperty<T, MergeIn> = {
  type: T;
} & MergeIn;

type IfPrepareActionMethodProvided<
  PA extends PrepareAction<any> | void,
  True,
  False
> = PA extends (...args: any[]) => any ? True : False;

type MetaOrVoid<PA extends PrepareAction<any>> = ReturnType<
  PA
> extends {
  meta: infer M;
}
  ? M
  : void;

type ErrorOrVoid<PA extends PrepareAction<any>> = ReturnType<
  PA
> extends {
  error: infer E;
}
  ? E
  : void;

type IfMaybeUndefined<P, True, False> = [undefined] extends [P]
  ? True
  : False;

type IfVoid<P, True, False> = [void] extends [P] ? True : False;
