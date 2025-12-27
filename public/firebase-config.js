// Firebase configuration for frontend
// Note: These are public configuration values and are safe to expose

const firebaseConfig = {
  apiKey: "AIzaSyCVCx7rqHjHRtHGBvQzJjqRqbXZrXvXvXv", // Replace with your actual API key
  authDomain: "se4458-tuition-chat.firebaseapp.com",
  databaseURL: "https://se4458-tuition-chat-default-rtdb.firebaseio.com",
  projectId: "se4458-tuition-chat",
  storageBucket: "se4458-tuition-chat.appspot.com",
  messagingSenderId: "123456789012", // Replace with your actual sender ID
  appId: "1:123456789012:web:abcdef1234567890" // Replace with your actual app ID
};

// Initialize Firebase (will be used in app.js)
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
}
