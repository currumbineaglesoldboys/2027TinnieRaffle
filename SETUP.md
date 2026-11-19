# Currumbin Eagles Old Boys Tinnie Raffle

## Current delivery

Source files and a separate interactive preview are ready. The live Apps Script project has not been edited or deployed. GitHub reports read-only integration access for this repository, so the files have not been published there. The preview uses fictional orders and sends no emails.

## Pages

- Public ticket requests at index.html. The public QR destination is intended to be https://currumbineaglesoldboys.github.io/2027TinnieRaffle/.
- Separate admin entry at admin.html. No admin link appears on the public page. Every admin data request also requires a valid server session.
- The QR image supplied alongside this package encodes the intended public URL. Publish and test the destination before distributing the QR.

## Apps Script setup

1. Open the supplied Apps Script project and inspect its existing files first. Preserve any existing functionality before adding these files.
2. Add Code.gs and App.html from apps-script. Apply the supplied manifest scopes and Brisbane timezone.
3. Run setupRaffle_ from the editor. It creates the Orders spreadsheet and preserves existing settings if run again. SHEET_ID is stored in Script Properties.
4. In Project Settings, add INITIAL_ADMIN_PIN with the chosen PIN. Run configureAdminPin_. This creates a salted hash and deletes the initial plaintext property. Never put the PIN in GitHub source. ADMIN_EMAIL defaults to currumbineaglesoldboys@gmail.com. Sign-in is rate limited after five failures, and sessions expire after two hours. Changing the PIN invalidates previous sessions. Anyone holding both the email and PIN can sign in, so keep the PIN private.
5. Deploy as a web app executing as the club account, with public access for the ticket-request form. Authorise spreadsheet access and sending email. The club account is the sender of ticket emails.
6. Paste the deployed /exec URL into config.js. Public and admin GitHub pages frame the Apps Script UI. No cross-origin public API or exposed customer spreadsheet is needed.

## GitHub Pages setup

Upload index.html, admin.html and config.js to the repository root. Keep the apps-script source and assets folders for maintenance. Enable GitHub Pages from the main branch root. The admin address will be https://currumbineaglesoldboys.github.io/2027TinnieRaffle/admin.html. Validate the public QR URL and admin sign-in on a phone after publication.

## Operating the raffle

Admin settings include ticket price, ticket limit, bank details or PayID, draw wording, public page URL and a sales-open switch. Sales start closed. Ticket price defaults to AUD 10. Set the ticket limit before opening. The draw wording defaults to At the Grand Final. Add final prize information, draw details and applicable raffle terms before opening sales.

Buyers request tickets and choose Bank transfer, EFTPOS at the bar, or Cash at senior home games. Their order remains Awaiting payment. They receive the reference and payment instructions on screen. Email delivery of the initial unpaid request is not included.

Admin can search requests, filter status, save follow-up notes, open a draft follow-up email, cancel an unpaid request, or confirm payment. Draft follow-up emails open in your email client and require you to send them. The admin enters the amount received and actual payment method before confirmation.

The server assigns sequential ticket numbers under a ScriptLock, writes them to the paid order, and then emails those numbers. A repeated confirmation returns the existing numbers. A failed or interrupted email can be retried with the same numbers after checking delivery. Ticket emails contain the order reference, number range, quantity, amount paid and Grand Final draw wording.

Pending requests reserve capacity within the ticket limit. They receive no ticket numbers until payment is confirmed. Cancel unpaid requests when releasing their reserved capacity. Paid ticket numbers are never recycled. Keep the Orders sheet protected and use the admin screen for normal operations. Manual edits to number columns could bypass the application's safeguards.

## Validation completed

Backend simulation checked authorised access, order retry deduplication, payment amount validation, sequential unique numbers across orders, repeated confirmations, failed email retry retaining existing numbers, follow-up notes, cancelled-order rejection and capacity limits. JavaScript syntax checks passed. Actual Apps Script permissions, email delivery, sign-in, mobile rendering and published QR scanning still require live validation after deployment.

