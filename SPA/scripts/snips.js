// var firebaseConfig = {
//     apiKey: "AIzaSyCauN-vsgUfQJXc5b41NoCnYzi6FIn86MQ",
//     authDomain: "linkshare-eb70b.firebaseapp.com",
//     databaseURL: "https://linkshare-eb70b-default-rtdb.firebaseio.com",
//     projectId: "linkshare-eb70b",
//     storageBucket: "linkshare-eb70b.appspot.com",
//     messagingSenderId: "284502085616",
//     appId: "1:284502085616:web:3f24e3fb844320eef85735",
//     measurementId: "G-VQ0J98LXYT",
//   };

//   // Initialize Firebase
//   firebase.initializeApp(firebaseConfig);

//   // Function to retrieve and display Snips
//   function displaySnips() {
//     var database = firebase.database();
//     var snipsList = document.getElementById("snipsList");

//     // Reference to the "snips" node in the database
//     var snipsRef = database.ref("snips");

//     // Listen for changes in the "snips" node
//     snipsRef.on("value", function (snapshot) {
//       snipsList.innerHTML = ""; // Clear the list

//       // Iterate through each Snip in the snapshot
//       snapshot.forEach(function (childSnapshot) {
//         var snipKey = childSnapshot.key;
//         var snipData = childSnapshot.val();

//         // Create a div for each Snip
//         var divItem = document.createElement("div");
//         divItem.classList.add("snip-container");

//         // Create label for name
//         var nameLabel = document.createElement("a");
//         nameLabel.textContent = snipData.name;
//         nameLabel.href= `edit.html?id=${snipKey}`;
//         divItem.appendChild(nameLabel);

//         // Create input for content with initial value
//         var inputItem = document.createElement("input");
//         inputItem.classList.add("copy-input");
//         inputItem.type = "text";

//         inputItem.value = snipData.content;
//         divItem.appendChild(inputItem);

//         // Create copy button
//         var copyButton = document.createElement("button");
// copyButton.classList.add("copy-button");
// copyButton.textContent = "Copy";
// copyButton.addEventListener("click", function () {
// inputItem.select();
// document.execCommand("copy");

// // Change textContent to white checkmark for 2 seconds
// copyButton.textContent = "✓";
// setTimeout(function () {
// copyButton.textContent = "Copy";
// }, 2000);
// });

// divItem.appendChild(copyButton);


//         // Append the div to the snipsList
//         snipsList.insertBefore(divItem, snipsList.firstChild);
//       });
//     });
//   }

//   // Call the displaySnips function to initially display Snips
//   displaySnips();
//   function showNotification(message) {
// var notification = document.createElement('div');
// notification.classList.add('notification');
// notification.textContent = message;

// document.body.appendChild(notification);

// // Remove the notification after a certain time (e.g., 3000 milliseconds)
// setTimeout(function() {
// notification.remove();
// }, 3000);
// }