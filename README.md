# Phonetic Justice

This project aims to build a system for the accurate pronunciation of multilingual names. It addresses the common challenge of mispronunciation by leveraging AI to predict the ethnic origin of a name and generate a phonetically correct audio representation.

## System Overview

The application is designed with a two-agent architecture:

1.  **Ethnicity Detection Agent:** Analyzes a given name to determine its most likely ethnic origin.
2.  **Pronunciation Generation Agent:** Uses the predicted ethnicity to select the correct linguistic model and generate an accurate audio pronunciation.

This approach allows for a modular and scalable system that can be continuously improved with new data and user feedback. 