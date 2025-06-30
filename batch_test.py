import json
import asyncio
import csv
from datetime import datetime
from src.phonetic_justice.agents import EthnicityDetectionAgent

async def run_batch_test():
    """
    Loads test names, runs them through the ethnicity detection agent,
    and saves the results to a CSV file.
    """
    print("Initializing Ethnicity Detection Agent...")
    try:
        agent = EthnicityDetectionAgent()
    except ValueError as e:
        print(f"Error: {e}")
        print("Please ensure your .env file is created and contains your GOOGLE_API_KEY.")
        return

    print("Loading test names from data/test_names.json...")
    with open('data/test_names.json', 'r', encoding='utf-8') as f:
        test_data = json.load(f)

    # Prepare CSV file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_filename = f"test_results_{timestamp}.csv"
    print(f"Results will be saved to '{csv_filename}'")
    
    with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['Name', 'True Language', 'Predicted Ethnicity', 'Confidence', 'Result']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        print("-" * 80)
        print("Starting batch test...")
        print("-" * 80)

        for language, names in test_data.items():
            print(f"\n--- Processing Language Group: {language} ---")
            for name in names:
                print(f"Testing name: '{name}'")
                try:
                    result = agent.run(name)
                    predicted_ethnicity = result.get('ethnicity', 'N/A')
                    confidence = result.get('confidence', 0.0)
                    
                    # Simple check for correctness
                    if language.lower().startswith(predicted_ethnicity.lower()[:4]):
                        check_result = "CORRECT"
                    else:
                        check_result = "CHECK MANUALLY"

                    # Write to CSV
                    writer.writerow({
                        'Name': name,
                        'True Language': language,
                        'Predicted Ethnicity': predicted_ethnicity,
                        'Confidence': f"{confidence:.2f}",
                        'Result': check_result
                    })
                    print(f"  -> Saved to CSV: '{predicted_ethnicity}' (Confidence: {confidence:.2f})")

                except Exception as e:
                    print(f"  -> Error processing name '{name}': {e}")
                    writer.writerow({
                        'Name': name,
                        'True Language': language,
                        'Predicted Ethnicity': 'Error',
                        'Confidence': 0.0,
                        'Result': str(e)
                    })
                
                await asyncio.sleep(1) # To avoid hitting API rate limits

    print("-" * 80)
    print(f"Batch test complete. Results saved to '{csv_filename}'.")

if __name__ == "__main__":
    asyncio.run(run_batch_test()) 