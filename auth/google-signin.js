function signInWithGoogle() {
    firebase.auth().signInWithPopup(googleAuthProvider)
        .then((result) => {
            // This gives you a Google Access Token.
            const token = result.credential.accessToken;
            // The signed-in user info.
            const user = result.user;
            console.log('User signed in:', user);

            // Check if the user already exists in the database
            const userRef = firebase.database().ref('users/' + user.uid);
            userRef.once('value')
                .then((snapshot) => {
                    if (!snapshot.exists()) {
                        // If the user doesn't exist, add them to the database
                        userRef.set({
                            displayName: user.displayName,
                            email: user.email,
                            photoURL: user.photoURL,
                            createdAt: firebase.database.ServerValue.TIMESTAMP,
                            lastLoginAt: firebase.database.ServerValue.TIMESTAMP
                        });
                    } else {
                        // If the user already exists, update the lastLoginAt timestamp
                        userRef.update({ lastLoginAt: firebase.database.ServerValue.TIMESTAMP });
                    }

                    // Redirect to the dashboard upon successful login
                    window.location.href = 'dashboard.html';
                })
                .catch((error) => {
                    console.error('Error checking/updating user in the database:', error);
                });

        })
        .catch((error) => {
            // Handle errors here.
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error(`Google Sign-In Error: ${errorCode} - ${errorMessage}`);
        });
}

function signOut() {
    firebase.auth().signOut().then(() => {
        console.log('User signed out.');
    }).catch((error) => {
        console.error('Sign-out error:', error);
    });
}