declare global {
	var __DEV__: boolean;
}

export { createClient } from './client';
export {
	useClient,
	useFetch,
	useRequest,
	ClientProvider,
} from './react';
