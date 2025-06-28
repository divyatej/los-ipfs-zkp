import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# Data for gas values
gas_data = {
    'Load': [
        'Lower-Capacity', 'Lower-Capacity', 'Lower-Capacity',
        'Higher-Capacity', 'Higher-Capacity', 'Higher-Capacity',
        'Very Slow Ramp-up', 'Very Slow Ramp-up', 'Very Slow Ramp-up'
    ],
    'Operation': [
        'requestUserAccess', 'grantAccess', 'approveLoan',
        'requestUserAccess', 'grantAccess', 'approveLoan',
        'requestUserAccess', 'grantAccess', 'approveLoan'
    ],
    'Gas': [
        23417760, 42080120, 124509768,
        75278341, 135142112, 400247008,
        80352189, 144290648, 427224072
    ]
}

gas_df = pd.DataFrame(gas_data)

# Create the grouped bar chart for gas values
plt.figure(figsize=(12, 7))
sns.barplot(x='Operation', y='Gas', hue='Load', data=gas_df, palette='viridis')

plt.title('Gas Used by Operation and Load')
plt.xlabel('Operation')
plt.ylabel('Gas Used')
plt.xticks(rotation=45, ha='right')
plt.legend(title='Load')
plt.tight_layout()
plt.show()