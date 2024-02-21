function addSnip() {
    const name = document.getElementById('name').value;
    const content = document.getElementById('content').value;
    const currentUser = firebase.auth().currentUser;

    // Check if both title and content are provided
    if (name && content) {
        // Get a reference to the database
        const database = firebase.database();

        if (currentUser) {
            // If there is a current user, add the snip with their email
            const snipRef = database.ref('snips').push();
            snipRef.set({
                name: name,
                content: content,
                test: 'test',
                url: 'test',
                email: currentUser.email
            })
            .then(() => {
                // Clear the input fields after adding the snip
                document.getElementById('name').value = '';
                document.getElementById('content').value = '';

                // Redirect to sniplist.html after successful save
                window.location.href = 'p/snips.html';
            })
            .catch((error) => {
                console.error('Error saving snip to database:', error);
                alert('An error occurred while saving the snip. Please try again.');
            });
        } else {
            alert('Please provide name and content.');
        }
    } else {
        alert('Please provide name and content.');
    }
}