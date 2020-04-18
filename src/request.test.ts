// Ours
import { buildRequest } from './request';

test('should throw if request.type is set', () => {
	expect(() => {
		buildRequest({ type: 'anything' } as any);
	}).toThrow(/request.type/);
});

test('should NOT throw if request.id is not set', () => {
	expect(() => {
		buildRequest({});
	}).not.toThrow();
});

test('should throw if request.id is set to an invalid value', () => {
	expect(() => {
		buildRequest({ id: 1 } as any);
	}).toThrow(/request.id/);

	expect(() => {
		buildRequest({ id: '' } as any);
	}).toThrow(/request.id/);

	expect(() => {
		buildRequest({ id: true } as any);
	}).toThrow(/request.id/);

	expect(() => {
		buildRequest({ id: {} } as any);
	}).toThrow(/request.id/);

	expect(() => {
		buildRequest({ id: [] } as any);
	}).toThrow(/request.id/);

	expect(() => {
		buildRequest({ id: false } as any);
	}).toThrow(/request.id/);

	expect(() => {
		buildRequest({ id: null } as any);
	}).not.toThrow();
});

test('should use stable stringify', () => {
	const obj1 = {
		query: 'test',
		url: '/api/url',
		variables: {
			a: 1,
			b: 2,
		},
		array: [1, 2],
	};

	const obj2 = {
		url: '/api/url',
		query: 'test',
		variables: {
			b: 2,
			a: 1,
		},
		array: [1, 2],
	};

	// keys order doesn't matter
	expect(buildRequest(obj1).id).toEqual(buildRequest(obj2).id);

	// array items DOES matter
	obj2.array = [2, 1];
	expect(buildRequest(obj1).id).not.toEqual(buildRequest(obj2).id);
});

test('should not stringify the request.id', () => {
	const reqA = { query: 'test', variables: [1, 2] };
	const reqB = { query: 'test', variables: {} };

	const idA = buildRequest(reqA).id;
	const idB = buildRequest(reqB).id;

	expect(JSON.parse(idA)).toEqual({ ...reqA });
	expect(JSON.parse(idB)).toEqual({ ...reqB });
});

test('should not stringify if req.id is already set', () => {
	const req = buildRequest({
		id: '__id__',
		query: 'test',
	});

	expect(req.id).toEqual('__id__');
});
