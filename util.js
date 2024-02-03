var clearButton = document.getElementById('clearInput');
var input = document.getElementById('textInput');

clearButton.addEventListener('click', function() {
  input.value = ''; // Clears the value of the textInput element
});

function copyText() {
  var retrievedTextElement = document.getElementById('retrievedText');
  var textToCopy = retrievedTextElement.innerText;

  // Create a temporary textarea element to copy text
  var tempTextarea = document.createElement('textarea');
  tempTextarea.value = textToCopy;

  // Append the textarea to the document
  document.body.appendChild(tempTextarea);

  // Select and copy the text
  tempTextarea.select();
  document.execCommand('copy');

  // Remove the temporary textarea
  document.body.removeChild(tempTextarea);

  // Change the text of the button to indicate copying
  var copyButton = document.getElementById('copyButton');
  copyButton.innerText = 'Copied!';

  // Change the button text back to 'Copy' after 1 second
  setTimeout(function() {
      copyButton.innerText = 'Copy';
  }, 1000); // 1000 milliseconds = 1 second
}
function resetInput() {
  // Reset the input value to an empty string
  var inputElement = document.getElementById('textInput');
  inputElement.value = '';
  
  // Set focus back to the input element
  //inputElement.focus();
  location.reload(true);
}





