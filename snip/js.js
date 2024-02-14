function copyCode() {
    const codeElement = document.getElementById('code');
    const codeText = codeElement.value;
  
    navigator.clipboard.writeText(codeText)
      .then(() => {
        // Create a tooltip element
        const tooltip = document.createElement('div');
        tooltip.classList.add('tooltip');
        tooltip.textContent = 'Copied!';
  
        // Append the tooltip to the body
        document.body.appendChild(tooltip);
  
        // Position the tooltip to the left of the copy icon
        const copyIcon = document.getElementById('copy-icon');
        const iconRect = copyIcon.getBoundingClientRect();
        tooltip.style.position = 'fixed';
tooltip.style.top = '10px'; // Adjust the top position as needed
tooltip.style.right = '10px'; // Adjust the right position as needed

//         tooltip.style.top = iconRect.top - tooltip.offsetHeight - 5 + 'px';
// tooltip.style.left = iconRect.left + iconRect.width / 2 - tooltip.offsetWidth / 2 + 'px';

  
        // Fade out and remove the tooltip after a short delay
        setTimeout(() => {
          tooltip.style.opacity = '0';
          setTimeout(() => {
            document.body.removeChild(tooltip);
          }, 300); // Adjust the duration of the fade-out animation
        }, 1500); // Adjust the duration the tooltip is visible
      })
      .catch(err => {
        console.error('Unable to copy code', err);
      });
  }
  

  const codeElement = document.getElementById('code');
  const initialHeight = codeElement.scrollHeight;
  
  codeElement.addEventListener('input', function () {
    const currentHeight = this.scrollHeight;
  
    if (this.value.trim() === '') {
      this.style.height = initialHeight + 'px';
    } else if (currentHeight > initialHeight) {
      this.style.height = currentHeight + 'px';
    }
  
    this.scrollTop = this.scrollHeight;
  });
  
  



  