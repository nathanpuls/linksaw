function saveText() {
  var textInput = document.getElementById("textInput").value;
  var inputElement = document.getElementById("textInput");
  inputElement.value = "";
  if (textInput.trim() !== "") {
    console.log("Text to be saved:", textInput);

    // Generate a random 4-digit ID
    var textID = generateRandomID();

    // Set the data to be saved in Firebase
    var textData = {
      text: textInput,
      // Set the expiration time to 2 minutes in the future
      expirationTime: new Date().getTime() + 2 * 60 * 1000,
    };

    // Push the data to generate a unique key (using the generated ID)
    var textRef = database.ref("texts/" + textID);
    textRef.set(textData).then(() => {
      console.log("Text successfully saved to Firebase:", textInput);
      // Optionally, start a timer for 2 minutes to automatically delete the text
      setTimeout(() => {
        textRef
          .remove()
          .then(() => {
            console.log("Text expired and removed from Firebase");
          })
          .catch((error) => {
            console.error("Error removing expired text from Firebase:", error);
          });
      }, 2 * 60 * 1000);
      //document.getElementById('textInput').value = '';
      var shareCodeDiv = document.getElementById("shareCode");
      shareCodeDiv.innerText = `Your code is: ${textID}`;
      console.log(textID);
      var form = document.getElementById('form'); 
      form.classList.add('formHidden');
      

    });
  } else {
    // Optionally, provide feedback or take action when the input is empty
    console.log("Input is empty. Please enter some text.");
  }
}

// Function to retrieve text based on the code parameter in the URL
function retrieveTextFromURL() {
  // Get the value of the 'code' parameter from the URL
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get("code");

  if (codeParam) {
    // If the 'code' parameter is present, retrieve the text
    retrieveText(codeParam);
  }
}

// Call the function when the page loads
window.onload = retrieveTextFromURL;

function retrieveText() {
  var codeInput = document.getElementById("textInput").value;
  var textInput = document.getElementById("textInput").value;
  var inputElement = document.getElementById("textInput");
  inputElement.value = "";
  var textRef = database.ref("texts/" + codeInput);
  //hideShareCode();
  if (codeInput) {
  var form = document.getElementById('form'); 
      form.classList.add('formHidden');
  }

  textRef
    .get()
    .then((snapshot) => {
      var textData = snapshot.val();
      if (textData) {
        // Check if the text has expired
        if (new Date().getTime() < textData.expirationTime) {
          // Display the retrieved text in a div with id 'retrievedText'
          var retrievedText = document.getElementById("retrievedText");
          retrievedText.innerText = textData.text;

          // Show or hide the copy button based on the retrieved text
          var copyButton = document.getElementById("copyButton");
          copyButton.style.display = textData.text ? "inline" : "none";

          // Make URLs clickable after updating the content
          makeUrlsClickable();
          
        } else {
          console.log("Text has expired and cannot be retrieved.");
        }
      } else {
        console.log("No text found with the provided code.");
      }
    })
    .catch((error) => {
      console.error("Error retrieving text from Firebase:", error);
    });
}

function hideShareCode() {
  var shareCodeDiv = document.getElementById("shareCode");
  if (shareCodeDiv) {
    shareCodeDiv.style.display = "none";
  }
}

// Keep track of used IDs
var usedIDs = new Set();

function generateRandomID() {
  // Create an array of digits from 0 to 9
  var digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Shuffle the array to get a random order
  for (var i = digits.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = digits[i];
    digits[i] = digits[j];
    digits[j] = temp;
  }

  // Take the first 4 digits to form the ID
  var randomID = digits.slice(0, 4).join(""); // we want 4

  // Check if the ID is already used, generate a new one if needed
  while (usedIDs.has(randomID)) {
    randomID = generateRandomID();
  }

  // Add the new ID to the set of used IDs
  usedIDs.add(randomID);

  return randomID;
}

// Function to make URLs clickable in retrievedText
function makeUrlsClickable() {
  var retrievedTextElement = document.getElementById("retrievedText");
  var content = retrievedTextElement.innerHTML;

  // Use a regular expression to find URLs starting with http/s
  var httpUrlRegex = /(https?:\/\/[^\s<>]+)/g;
  content = content.replace(httpUrlRegex, function (url) {
    return '<a href="' + url + '" target="_blank">' + url + "</a>";
  });

  // Use a regular expression to find URLs starting with www
  var wwwUrlRegex = /(?:^|[^"'])(www\.[^\s<>]+)/g;
  content = content.replace(wwwUrlRegex, function (url) {
    return '<a href="http://' + url + '" target="_blank">' + url + "</a>";
  });

  // Set the modified content back to the element
  retrievedTextElement.innerHTML = content;
}
