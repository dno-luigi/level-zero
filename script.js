const menuButton = document.getElementById('menuButton');
    const talkButton = document.getElementById('talkButton');
    const messageInput = document.getElementById('messageInput');
    const conversation = document.getElementById('conversation');
    const applet = document.getElementById('applet');
    const closeSettings = document.getElementById('closeSettings');
    const saveSettings = document.getElementById('saveSettings');
    const favoriteModelSelect = document.getElementById('favoriteModelSelect');
    const manualModelInput = document.getElementById('manualModelInput');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const userInfoInput = document.getElementById('userInfoInput');
    const responseInstructionsInput = document.getElementById('responseInstructionsInput');
    const aiSpeechToggle = document.getElementById('aiSpeechToggle');
    const toggleMode = document.getElementById('toggleMode');

    let recognizing = false;
    let recognition;
    let selectedModel = 'google/gemini-2.0-flash-lite-preview-02-05:free';
    let apiKey = '';
    let userInfo = '';
    let responseInstructions = '';
    let aiSpeechEnabled = true;
    let isDarkMode = false;
    let currentUtterance = null; // Variable to hold the current utterance

    // Function to create a button element
    function createButton(innerHTML, onClick) {
      const button = document.createElement('button');
      button.innerHTML = innerHTML;
      button.style.marginLeft = '10px';
      button.addEventListener('click', onClick);
      return button;
    }

    // Function to sanitize text for speech synthesis
    function sanitizeTextForSpeech(text) {
      // Replace markdown formatting with spoken equivalents
      return text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
        .replace(/`(.*?)`/g, '$1') // Remove inline code formatting
        .replace(/```(.*?)```/g, 'Here is the code: $1'); // Handle code blocks
    }

    // Initialize speech recognition if supported
    function initializeSpeechRecognition() {
      if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          recognizing = true;
          updateTalkButtonText();
        };

        recognition.onend = () => {
          recognizing = false;
          updateTalkButtonText();
        };

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          messageInput.value = transcript;
          addMessage();
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
        };
      } else {
        talkButton.innerHTML = '<i class="fas fa-envelope"></i>';
        talkButton.disabled = true;
      }
    }

    // Update the talk button text based on recognition state
    function updateTalkButtonText() {
      talkButton.innerHTML = recognizing ? '<i class="fas fa-stop"></i>' : 
        (aiSpeechEnabled && 'webkitSpeechRecognition' in window ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-envelope"></i>');
    }

    // Toggle the applet visibility
    function toggleApplet() {
      applet.classList.toggle('open');
    }

    // Save settings to local storage
    function saveSettingsToLocalStorage() {
      localStorage.setItem('selectedModel', selectedModel);
      localStorage.setItem('apiKey', apiKey);
      localStorage.setItem('userInfo', userInfo);
      localStorage.setItem('responseInstructions', responseInstructions);
      localStorage.setItem('aiSpeechEnabled', aiSpeechEnabled.toString());
      localStorage.setItem('isDarkMode', isDarkMode);
    }

    // Add a message to the conversation
    async function addMessage() {
      const message = messageInput.value.trim();
      if (message) {
        appendUserMessage(message);
        messageInput.value = '';
        conversation.scrollTop = conversation.scrollHeight;

        const typingElement = createTypingIndicator();
        conversation.appendChild(typingElement);
        conversation.scrollTop = conversation.scrollHeight;

        try {
          const aiMessageContent = await fetchAIResponse(message);
          appendAIMessage(aiMessageContent);
        } catch (error) {
          appendErrorMessage(error.message); // Use the existing error handling function
        } finally {
          conversation.removeChild(typingElement);
        }
      }
    }

    // Append user message to the conversation
    function appendUserMessage(message) {
      const userMessageElement = document.createElement('div');
      userMessageElement.classList.add('message', 'user-message');
      userMessageElement.textContent = message;
      conversation.appendChild(userMessageElement);
    }

    // Create typing indicator element
    function createTypingIndicator() {
      const typingElement = document.createElement('div');
      typingElement.classList.add('message', 'ai-message', 'typing-indicator');
      typingElement.innerHTML = `<span></span><span></span><span></span>`;
      return typingElement;
    }

    // Fetch AI response from the API
    async function fetchAIResponse(message) {
      const payload = {
        model: selectedModel,
        messages: [
          { role: "system", content: `What you should know about me: ${userInfo}\nHow you will respond: ${responseInstructions}` },
          { role: "user", content: message }
        ]
      };

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data && data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
      } else {
        throw new Error('Invalid response from API');
      }
    }

    // Append AI message to the conversation
    function appendAIMessage(aiMessageContent) {
      const aiMessageElement = document.createElement('div');
      aiMessageElement.classList.add('message', 'ai-message');

      // Create a code block if the content is a code block
      if (aiMessageContent.startsWith('```') && aiMessageContent.endsWith('```')) {
        const codeContent = aiMessageContent.slice(3, -3).trim(); // Remove the ``` markers
        const codeBlock = document.createElement('pre');
        codeBlock.classList.add('code-block');
        codeBlock.style.backgroundColor = 'black'; // Set background color for code block
        codeBlock.textContent = codeContent;

        // Add copy button to the code block
        const copyButton = createButton('Copy', () => {
          navigator.clipboard.writeText(codeContent).then(() => {
            alert('Code copied to clipboard');
          });
        });
        codeBlock.appendChild(copyButton);
        aiMessageElement.appendChild(codeBlock);
      } else {
        aiMessageElement.innerHTML = marked.parse(aiMessageContent);
      }

      addMessageButtons(aiMessageElement, aiMessageContent);
      conversation.appendChild(aiMessageElement);
      conversation.scrollTop = conversation.scrollHeight;

      if (aiSpeechEnabled) {
        if (currentUtterance) {
          speechSynthesis.cancel(); // Stop any ongoing speech
        }
        currentUtterance = new SpeechSynthesisUtterance(sanitizeTextForSpeech(aiMessageContent));
        currentUtterance.lang = 'en-US';
        speechSynthesis.speak(currentUtterance);
      }
    }

    // Add buttons to the AI message
    function addMessageButtons(aiMessageElement, aiMessageContent) {
      const buttonContainer = document.createElement('div');
      buttonContainer.classList.add('button-container');

      const copyButton = createButton('<i class="fas fa-copy"></i>', () => {
        navigator.clipboard.writeText(aiMessageContent).then(() => {
          alert('Response copied to clipboard');
        });
      });

      const speakButton = createButton('<i class="fas fa-volume-up"></i>', () => {
        if (currentUtterance) {
          speechSynthesis.cancel(); // Stop any ongoing speech
        }
        currentUtterance = new SpeechSynthesisUtterance(sanitizeTextForSpeech(aiMessageContent));
        currentUtterance.lang = 'en-US';
        speechSynthesis.speak(currentUtterance);
      });

      const deleteButton = createButton('<i class="fas fa-trash"></i>', () => {
        conversation.removeChild(aiMessageElement);
      });

      buttonContainer.appendChild(copyButton);
      buttonContainer.appendChild(speakButton);
      buttonContainer.appendChild(deleteButton);
      aiMessageElement.appendChild(buttonContainer);
    }

    // Append error message to the conversation
    function appendErrorMessage(errorMessage) {
      const errorMessageElement = document.createElement('div');
      errorMessageElement.classList.add('message', 'ai-message');
      errorMessageElement.textContent = `Error: ${errorMessage}`;
      conversation.appendChild(errorMessageElement);
      conversation.scrollTop = conversation.scrollHeight;
    }

    // Toggle dark mode
    function toggleDarkMode() {
      document.body.classList.toggle('dark-mode');
      document.body.classList.toggle('light-mode');
      isDarkMode = !isDarkMode;
      const modeIcon = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
      toggleMode.innerHTML = modeIcon;
    }

    // Event listeners
    menuButton.addEventListener('click', toggleApplet);
    saveSettings.addEventListener('click', () => {
      selectedModel = favoriteModelSelect.value === 'manual' ? manualModelInput.value : favoriteModelSelect.value;
      apiKey = apiKeyInput.value;
      userInfo = userInfoInput.value;
      responseInstructions = responseInstructionsInput.value;
      aiSpeechEnabled = aiSpeechToggle.checked;
      apiKeyInput.style.display = 'none'; // Hide API key input after saving
      saveSettingsToLocalStorage();
      applet.classList.remove('open');
    });

    favoriteModelSelect.addEventListener('change', () => {
      manualModelInput.style.display = favoriteModelSelect.value === 'manual' ? 'block' : 'none';
    });

    talkButton.addEventListener('click', () => {
      if (recognizing) {
        recognition.stop();
      } else if (aiSpeechEnabled && 'webkitSpeechRecognition' in window) {
        recognition.start();
      }
      speechSynthesis.cancel(); // Interrupt any ongoing speech when the button is clicked
    });

    messageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        addMessage();
      }
    });

    toggleMode.addEventListener('click', toggleDarkMode);

    // Initialize the application
    function initializeApp() {
      initializeSpeechRecognition();
      loadSettingsFromLocalStorage();
      updateTalkButtonText();
    }

    // Load settings from local storage
    function loadSettingsFromLocalStorage() {
      selectedModel = localStorage.getItem('selectedModel') || selectedModel;
      apiKey = localStorage.getItem('apiKey') || '';
      userInfo = localStorage.getItem('userInfo') || '';
      responseInstructions = localStorage.getItem('responseInstructions') || '';
      aiSpeechEnabled = localStorage.getItem('aiSpeechEnabled') === 'true';
      isDarkMode = localStorage.getItem('isDarkMode') === 'true';

      favoriteModelSelect.value = selectedModel;
      apiKeyInput.value = apiKey;
      userInfoInput.value = userInfo;
      responseInstructionsInput.value = responseInstructions;
      aiSpeechToggle.checked = aiSpeechEnabled;

      if (isDarkMode) {
        document.body.classList.add('dark-mode');
        toggleMode.innerHTML = '<i class="fas fa-sun"></i>';
      } else {
        document.body.classList.add('light-mode');
        toggleMode.innerHTML = '<i class="fas fa-moon"></i>';
      }
    }

    window.onload = initializeApp;
