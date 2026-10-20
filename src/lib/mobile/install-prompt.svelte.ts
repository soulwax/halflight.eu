export type InstallPromptEvent = Event & {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export const installPromptState = $state<{ event: InstallPromptEvent | null }>({ event: null });

export function captureInstallPrompt(event: Event): void {
	event.preventDefault();
	installPromptState.event = event as InstallPromptEvent;
}
