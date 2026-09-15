/** Client-safe private-music contracts returned by Syn's authenticated API. */
export interface PrivateMusicFormat {
	label: string;
	contentType: string;
	extensions: string[];
}

export interface PrivateMusicFile {
	id: string;
	fileName: string;
	contentType: string;
	sizeBytes: number;
	createdAt: string;
	downloadUrl: string;
}

export interface PrivateMusicStorage {
	fileCount: number;
	usedBytes: number;
	availableBytes: number;
	maxTotalBytes: number;
	maxFileBytes: number;
}

export interface PrivateMusicLibraryData {
	enabled: boolean;
	formats: PrivateMusicFormat[];
	storage: PrivateMusicStorage;
	files: PrivateMusicFile[];
}

export function privateMusicDownloadUrl(file: PrivateMusicFile): string {
	return `${file.downloadUrl}?download=1`;
}

export function privateMusicAccept(formats: PrivateMusicFormat[]): string {
	return formats
		.flatMap((format) => format.extensions.map((extension) => `.${extension}`))
		.join(',');
}
