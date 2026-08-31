/** Minimal JSON:API (https://jsonapi.org) types for the shapes TIDAL returns. */

export interface ResourceIdentifier {
	id: string;
	type: string;
}

export interface Relationship {
	data?: ResourceIdentifier | ResourceIdentifier[] | null;
	links?: { self?: string; related?: string; next?: string };
}

export interface Resource<A = Record<string, unknown>> extends ResourceIdentifier {
	attributes?: A;
	relationships?: Record<string, Relationship>;
	links?: Record<string, string>;
}

export interface Document<D = Resource | Resource[]> {
	data: D;
	included?: Resource[];
	links?: { self?: string; next?: string; prev?: string };
	errors?: Array<{ status?: string; title?: string; detail?: string }>;
}

/** Index a document's `included` array by `type:id` for relationship resolution. */
export function indexIncluded(doc: Document<Resource | Resource[]>): Map<string, Resource> {
	const map = new Map<string, Resource>();
	for (const r of doc.included ?? []) map.set(`${r.type}:${r.id}`, r);
	return map;
}

/** Resolve one relationship's linkage against an `included` index. */
export function resolveRelationship(
	resource: Resource,
	name: string,
	included: Map<string, Resource>
): Resource[] {
	const rel = resource.relationships?.[name]?.data;
	if (!rel) return [];
	const ids = Array.isArray(rel) ? rel : [rel];
	return ids.map((id) => included.get(`${id.type}:${id.id}`) ?? { id: id.id, type: id.type });
}
