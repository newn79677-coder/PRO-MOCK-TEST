// Listen for the 'beforeinstallprompt' event to show the install button
let deferredPrompt;
const installButton = document.getElementById('installButton');

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Show your custom install button
  if (installButton) installButton.style.display = 'block';
});

// Handle install button click
if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    // We've used the prompt, and can't use it again, discard it
    deferredPrompt = null;
    // Hide the install button
    installButton.style.display = 'none';
  });
}