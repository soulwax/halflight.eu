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
