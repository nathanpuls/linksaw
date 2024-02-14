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

function addSnip() {
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;

    // Check if both title and content are provided
    if (title && content) {
        // Get a reference to the database
        const database = firebase.database();

        // Push the snip to the database
        const snipRef = database.ref('snips').push();
        snipRef.set({
            title: title,
            content: content
        });

        // Clear the input fields after adding the snip
        document.getElementById('title').value = '';
        document.getElementById('content').value = '';

        alert('Snip added successfully!');
    } else {
        alert('Please provide both title and content.');
    }
}
