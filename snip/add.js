// firebase-config.js
var firebaseConfig = {
    apiKey: "AIzaSyCauN-vsgUfQJXc5b41NoCnYzi6FIn86MQ",
    authDomain: "linkshare-eb70b.firebaseapp.com",
    databaseURL: "https://linkshare-eb70b-default-rtdb.firebaseio.com",
    projectId: "linkshare-eb70b",
    storageBucket: "linkshare-eb70b.appspot.com",
    messagingSenderId: "284502085616",
    appId: "1:284502085616:web:3f24e3fb844320eef85735",
    measurementId: "G-VQ0J98LXYT"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Assuming you have the currentUser defined before this point

// Add an authentication state observer
firebase.auth().onAuthStateChanged(function (user) {
    if (!user) {
        // If there is no user, redirect to the home page
        window.location.href = '/';
    }
});

function addSnip() {
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const currentUser = firebase.auth().currentUser;

    // Check if both title and content are provided
    if (title && content) {
        // Get a reference to the database
        const database = firebase.database();

        if (currentUser) {
            // If there is a current user, add the snip with their email
            const snipRef = database.ref('snips').push();
            snipRef.set({
                name: title,
                content: content,
                test: 'test',
                url: 'test',
                email: currentUser.email
            })
            .then(() => {
                // Clear the input fields after adding the snip
                document.getElementById('title').value = '';
                document.getElementById('content').value = '';

                // Redirect to sniplist.html after successful save
                window.location.href = 'sniplist.html';
            })
            .catch((error) => {
                console.error('Error saving snip to database:', error);
                alert('An error occurred while saving the snip. Please try again.');
            });
        } else {
            alert('Please provide both title and content.');
        }
    } else {
        alert('Please provide both title and content.');
    }
}

