import { SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER } from '$app/env/private';
import nodemailer from 'nodemailer';

/** Deliver account-verification mail through the configured Postfix SMTP relay. */
export async function sendVerificationEmail(input: {
	to: string;
	name: string;
	url: string;
}): Promise<void> {
	const port = Number(SMTP_PORT ?? '25');
	const from = SMTP_FROM ?? 'Halflight <noreply@adminmail.bluesix.dev>';
	const transport = nodemailer.createTransport({
		host: SMTP_HOST ?? '127.0.0.1',
		port: Number.isSafeInteger(port) && port > 0 ? port : 25,
		secure: port === 465,
		...(SMTP_USER && SMTP_PASSWORD ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD } } : {})
	});

	await transport.sendMail({
		from,
		to: input.to,
		subject: 'Verify your Halflight email address',
		text: `Hi ${input.name},\n\nVerify your email address to start using Halflight:\n${input.url}\n`,
		html: `<p>Hi ${escapeHtml(input.name)},</p><p><a href="${escapeHtml(input.url)}">Verify your email address</a> to start using Halflight.</p>`
	});
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>'"]/g, (character) => {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]!;
	});
}
