document.addEventListener('DOMContentLoaded', function () {
    // Get a reference to the Firebase database
    const database = firebase.database();

    // Get a reference to the textarea
    const editor = document.getElementById('editor');

    // Extract the pathname from the URL
    const pathname = window.location.pathname;

    // Replace non-alphanumeric characters with underscores to use as a key
    const pageId = pathname.replace(/[^a-zA-Z0-9]/g, '_');

    // Get a reference to the specific path in the database
    const contentRef = database.ref('pages/' + pageId);

    // Listen for changes in the textarea and update the database
    editor.addEventListener('input', function () {
        contentRef.set({
            content: editor.value,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    });

    // Listen for changes in the database and update the textarea
    contentRef.on('value', function (snapshot) {
        const data = snapshot.val();
        if (data) {
            editor.value = data.content || '';
        }
    });

    // Update the h1 element with the current pathname
    const pageTitle = document.createElement('h1');
    pageTitle.textContent = `Page: ${pathname}`;
    document.body.appendChild(pageTitle);
});
