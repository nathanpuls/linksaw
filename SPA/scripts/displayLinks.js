// displayLinks.js

// Initialize Firebase (replace with your own Firebase config)
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
  
  firebase.initializeApp(firebaseConfig);
  
  // Function to display links
  function displayLinks() {
      const currentUser = firebase.auth().currentUser;
  
      if (currentUser) {
          const username = currentUser.email.replace(/@gmail\.com$/i, "");
          const linksRef = firebase.database().ref("users/" + username + "/links");
  
          linksRef.once("value", (snapshot) => {
              const linksList = document.getElementById("linksList");
  
              snapshot.forEach((childSnapshot) => {
                  const linkData = childSnapshot.val();
                  const listItem = document.createElement("li");
  
                  // Display link data as list items
                  listItem.innerHTML = `<strong>${linkData.name}</strong>: ${linkData.url}, ${linkData.timestamp}`;
  
                  linksList.appendChild(listItem);
              });
          });
      } else {
          console.error("User not logged in");
          // Handle the case where the user is not logged in
      }
  }
  
  // Call the function to display links when the page loads
  document.addEventListener("DOMContentLoaded", displayLinks);
  