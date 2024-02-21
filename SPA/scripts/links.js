
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
    let username = email.split("@")[0];
    username = username.replace(/\./g, '');
    console.log("1:" + username); // Log the username to the console
    return username; // Return the username
  }
  
  // Function to copy link to clipboard
  function copyLink(username, linkName) {
    // var fullLink = `https://${username}.linksaw.com/${linkName}`;
    var fullLink = `https://${linkName}.linksaw.com/${username}`;
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

          username = username.replace(/\./g, ''); // USERNAME REMOVE PERIODS 2
          
          var truncatedName =
            linkData.name.length > 15
              ? linkData.name.slice(0, 15) + "..."
              : linkData.name;
          
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
          var listItem = document.createElement("p");
          listItem.innerHTML = `
      <div class="row">
      <a href="${url}" target="_blank"><div>${truncatedName}</div></a>
      
          
      <a href="edit-link.html?id=${linkKey}" target="_blank" style="display: inline-block; width: 30px; height: 30px; overflow: hidden;">
  <?xml version="1.0" ?><!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 20010904//EN' 'http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd'>
  <svg height="30" preserveAspectRatio="xMidYMid meet" version="1.0" viewBox="0 0 256.000000 256.000000" width="30" xmlns="http://www.w3.org/2000/svg">
      <!-- Your SVG path here -->
      <g fill="#000000" stroke="none" transform="translate(0.000000,256.000000) scale(0.100000,-0.100000)">
          <path d="M2016 2465 c-22 -8 -53 -24 -70 -36 -35 -25 -175 -171 -345 -359 -320 -352 -690 -719 -1088 -1078 l-190 -170 -41 -105 c-66 -169 -203 -587 -200 -610 2 -13 11 -23 24 -25 21 -3 316 96 559 188 162 62 138 42 400 335 319 356 648 680 1090 1071 283 252 325 307 325 428 -1 68 -31 115 -156 237 -91 89 -128 119 -159 128 -53 14 -101 13 -149 -4z m117 -159 c46 -19 173 -154 181 -193 4 -17 2 -50 -4 -72 -12 -47 -56 -90 -420 -422 -390 -355 -503 -467 -1021 -1009 l-187 -195 -78 -29 c-44 -16 -84 -31 -91 -33 -6 -3 -14 6 -18 18 -11 32 -81 105 -116 119 -36 15 -35 23 12 135 28 67 38 79 251 280 351 332 706 689 954 960 331 362 392 423 439 440 51 18 59 18 98 1z"/>
      </g>
  </svg>
</a>

          
          </div>`;
  
          linksList.insertBefore(listItem, linksList.firstChild);
          
          
          
  
  
       
        });
      })
      .catch(function (error) {
        console.error("Error loading links:", error);
      });
  }
  

  
 
  
    // Get the current user
    var currentUser = firebase.auth().currentUser;
  
    // Check if the user is signed in
    if (currentUser) {
      // Check if a link with the same name already exists
      var linksRef = database.ref("links/" + currentUser.uid);
      
      linksRef.once("value")
        .then(function(snapshot) {
          var duplicateExists = false;
  
          snapshot.forEach(function(childSnapshot) {
            var existingName = childSnapshot.val().name.toLowerCase();
            if (existingName === name) {
              duplicateExists = true;
            }
          });
  
          if (duplicateExists) {
            // alert("A link with the same name already exists. Please choose a different name.");
            showAlert("Another link has that name.");
          } else {
            // Save the link to the database
            var linkRef = linksRef.push();
            linkRef
              .set({
                url: url,
                name: name,
                username: getUsernameFromEmail(currentUser.email),
                timestamp: formattedTime,
              })
              .then(function () {
                // Clear the input fields after adding the link
                document.getElementById("url").value = "";
                document.getElementById("name").value = "";
                // Reload the links
                loadLinks(currentUser.uid);
              })
              .catch(function (error) {
                alert("Error adding link: " + error.message);
              });
          }
        })
        .catch(function (error) {
          alert("Error checking for duplicate link: " + error.message);
        });
    } 
  


  
  
  
  
  firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
      // User is signed in
      console.log("User is signed in:", user);
  
      // Extract the username from the email
      var username = getUsernameFromEmail(user.email);
      username = username.replace(/\./g, ''); // USERNAME REMOVE PERIODS 1
  
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
  