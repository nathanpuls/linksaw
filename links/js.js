// Initialize Firebase
var firebaseConfig = {
  apiKey: "AIzaSyCauN-vsgUfQJXc5b41NoCnYzi6FIn86MQ",
  authDomain: "linkshare-eb70b.firebaseapp.com",
  databaseURL: "https://linkshare-eb70b-default-rtdb.firebaseio.com",
  projectId: "linkshare-eb70b",
  storageBucket: "linkshare-eb70b.appspot.com",
  messagingSenderId: "284502085616",
  appId: "1:284502085616:web:3f24e3fb844320eef85735",
  measurementId: "G-VQ0J98LXYT",
};

firebase.initializeApp(firebaseConfig);
var database = firebase.database();

// Function to extract username from email
function getUsernameFromEmail(email) {
  var username = email.split("@")[0];
  console.log("1:" + username); // Log the username to the console
  return username; // Return the username
}

// Function to copy link to clipboard
function copyLink(username, linkName) {
  var fullLink = `https://${username}.linksaw.com/${linkName}`;
  var partialLink = fullLink.slice(8);
  navigator.clipboard
    .writeText(fullLink)
    .then(function () {
      // alert('Link copied to clipboard: ' + fullLink);
      showAlert("Copied: " + partialLink);
    })
    .catch(function (error) {
      console.error("Error copying link to clipboard:", error);
    });
}

// Add an authentication state observer
firebase.auth().onAuthStateChanged(function (user) {
  if (user) {
    loadLinks(user.uid);
  } else {
    document.getElementById("linksList").innerHTML =
      "Please sign in to view your links.";
    window.location.href = "/";
  }
});

function loadLinks(userId) {
  var linksList = document.getElementById("linksList");
  var linkTop = document.getElementById("link-top");

  // Clear the existing list
  linksList.innerHTML = "";

  // Load links from the database
  var linksRef = database.ref("links/" + userId);
  linksRef
    .once("value")
    .then(function (snapshot) {
      snapshot.forEach(function (childSnapshot) {
        var linkKey = childSnapshot.key;
        var linkData = childSnapshot.val();
        var username = linkData.username;
        var truncatedUrl =
          linkData.url.length > 15
            ? linkData.url.slice(0, 15) + "..."
            : linkData.url;
        var truncatedName =
          linkData.name.length > 15
            ? linkData.name.slice(0, 15) + "..."
            : linkData.name;
        console.log(truncatedUrl);
        let url = linkData.url;
        if (
          !url.startsWith("http://") &&
          !url.startsWith("https://") &&
          !url.startsWith("www")
        ) {
          // If not, add http:// to the beginning
          url = "http://" + url;
        }

        // Create list item for each link
        var listItem = document.createElement("li");
        listItem.innerHTML = `
    <div class="row">
    <div class = "mr-10"><strong>${truncatedName}</strong></div>
        <a href="${url}" target="_blank" class="smalltext">${truncatedUrl}</a>
        <div class="icon-container">
        <button onclick="editLink('${userId}', '${linkKey}', '${linkData.url}', '${linkData.name}')" class="font-awesome"><i class="fa-solid fa-pen"></i></button>
        <button onclick="deleteLink('${userId}', '${linkKey}')" class="font-awesome"><i class="fa-solid fa-trash"></i></i></button>
        <button onclick="copyLink('${username}', '${linkData.name}')" class="font-awesome"><i class="fa-regular fa-copy"></i></button>
        </div>
        </div>`;

        linksList.insertBefore(listItem, linksList.firstChild);
        linkTop.style.display = "flex";
        linkTop.style.flexDirection = "column";
        var urlInput = document.getElementById("url");

        urlInput.setAttribute("autofocus", true);
        urlInput.focus();

        // linksList.appendChild(listItem);
      });
    })
    .catch(function (error) {
      console.error("Error loading links:", error);
    });
}
function handleKeyDown(event) {
  if (event.key === "Enter") {
    addLink();
    document.getElementById("url").focus();
  }
}
function addLink() {
  var url = document.getElementById("url").value;
  let name = document.getElementById("name").value;
  name = name.replace(/[^\w\s]/gi, "").replace(/\s/g, "");
  name = name.toLowerCase();

  // Check if URL and Name are not empty
  if (!url.trim() || !name.trim()) {
    alert("Please enter a valid URL and Name.");
    return;
  }

  // Get the current user
  var currentUser = firebase.auth().currentUser;

  // Check if the user is signed in
  if (currentUser) {
    // Save the link to the database
    var linkRef = database.ref("links/" + currentUser.uid).push();
    linkRef
      .set({
        url: url,
        name: name,
        username: getUsernameFromEmail(currentUser.email),
      })
      .then(function () {
        //alert('Link added successfully!');
        // Clear the input fields after adding the link
        document.getElementById("url").value = "";
        document.getElementById("name").value = "";
        // Reload the links
        loadLinks(currentUser.uid);
      })
      .catch(function (error) {
        alert("Error adding link: " + error.message);
      });
  } else {
    alert("No user signed in.");
  }
}
document.getElementById("url").addEventListener("keydown", handleKeyDown);
document.getElementById("name").addEventListener("keydown", handleKeyDown);

function editLink(userId, linkKey, currentUrl, currentName) {
  var newUrl = prompt("Enter the new URL:", currentUrl);
  var newName = prompt("Enter the new Name:", currentName);
  newName = newName.replace(/[^\w\s]/gi, "").replace(/\s/g, "");
  newName = newName.toLowerCase();

  // Check if the user entered a new URL and Name
  if (newUrl !== null && newName !== null) {
    // Update the link in the database
    database
      .ref("links/" + userId + "/" + linkKey)
      .update({
        url: newUrl,
        name: newName,
      })
      .then(function () {
        //alert('Link updated successfully!');
        // Reload the links
        loadLinks(userId);
      })
      .catch(function (error) {
        alert("Error updating link: " + error.message);
      });
  }
}

function deleteLink(userId, linkKey) {
  // Delete the link from the database
  database
    .ref("links/" + userId + "/" + linkKey)
    .remove()
    .then(function () {
      // Reload the links
      loadLinks(userId);
    })
    .catch(function (error) {
      console.error("Error deleting link: " + error.message);
    });
}

firebase.auth().onAuthStateChanged(function (user) {
  if (user) {
    // User is signed in
    console.log("User is signed in:", user);

    // Extract the username from the email
    var username = getUsernameFromEmail(user.email);

    console.log("Username:", username);
    document.title = "Links @" + username;

    // Display the username
    var usernameElement = document.getElementById("username");
    usernameElement.innerText = "   " + `   @${username}`;

    //User profile image
    var profileImageElement = document.getElementById("profileImage");
    profileImageElement.src = "https://placehold.co/40x40/png"; // Placeholder image URL

    // Check if user.photoURL is available
    if (user.photoURL) {
      profileImageElement.src = user.photoURL; // Update with the actual profile image URL
    }
  } else {
    // No user signed in
    console.log("No user signed in.");

    // Clear the username display when no user is signed in
    var usernameElement = document.getElementById("username");
    usernameElement.innerText = "";
  }
});

function getUsernameFromEmail(email) {
  // Implement the logic to extract the username from the email
  // For example, remove the "@gmail.com" part
  return email.split("@")[0];
}

function showAlert(message) {
  var alertDiv = document.createElement("div");
  alertDiv.className = "alert";
  alertDiv.textContent = message;
  document.body.appendChild(alertDiv);

  // Set a timeout to remove the alert after 2000 milliseconds (2 seconds)
  setTimeout(function () {
    alertDiv.remove();
  }, 3000);
}
