class SpeechService {
  constructor() {
    this.enabled = true;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
  }

  speak(text) {
    if (!this.isSupported || !this.enabled || !text) return;

    try {
      window.speechSynthesis.cancel(); // Stop any pending utterance
      
      // If text is like "Gesture 9 - I", speak "I" or clean vocalization
      let cleanText = text;
      if (text.includes(" - ")) {
        const parts = text.split(" - ");
        cleanText = parts[parts.length - 1].trim();
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }

  stop() {
    if (this.isSupported) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speech = new SpeechService();
