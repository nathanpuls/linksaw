function addLink() {
    const name = document.getElementById("name").value;
    const url = document.getElementById("url").value;
    const currentUser = firebase.auth().currentUser;

    // Check if both title and content are provided
    if (name && url) {
        // Get a reference to the database
        const database = firebase.database();

        if (currentUser) {
            // If there is a current user, add the link under their UID
            const userUID = currentUser.uid;
            const username = currentUser.email.replace(/@gmail\.com$/i, "");

            // Use the input name as the link name
            const linkRef = database.ref("users/" + username + "/links/" + name);

            // Check if the link with the given name already exists
            linkRef.once('value', (snapshot) => {
                if (snapshot.exists()) {
                    // The link with the given name already exists
                    alert("A link with the same name already exists. Please use a different name.");
                } else {
                    // The link name is unique, proceed with adding the link
                    const currentTime = new Date();

                    // Format the date in MM/DD/YYYY at h:mm a format
                    const options = {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                    };
                    const formattedTime = currentTime.toLocaleString("en-US", options);

                    linkRef
                        .set({
                            name: name,
                            url: url,
                            timestamp: formattedTime,
                        })
                        .then(() => {
                            // Clear the input fields after adding the link
                            document.getElementById("name").value = "";
                            document.getElementById("url").value = "";

                            // Redirect to links.html after successful save
                            // window.location.href = "p/links.html";
                        })
                        .catch((error) => {
                            console.error("Error saving link to database:", error);
                            alert("An error occurred while saving the link. Please try again.");
                        });
                }
            });
        } else {
            alert("Please provide url and name.");
        }
    } else {
        alert("Please provide url and name.");
    }
}
