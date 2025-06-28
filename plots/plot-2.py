import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

# Data provided by the user
data = {
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
    'Latency (ms)': [
        431448.57, 806895.47, 897496.85,
        5191605.74, 6362362.44, 5446310.13,
        5393987.98, 10729418.03, 8348780.54
    ]
}

df = pd.DataFrame(data)

# Create the grouped bar chart
plt.figure(figsize=(12, 7))
sns.barplot(x='Operation', y='Latency (ms)', hue='Load', data=df, palette='viridis')

plt.title('Average Latency (ms) by Operation and Load')
plt.xlabel('Operation')
plt.ylabel('Average Latency (ms)')
plt.xticks(rotation=45, ha='right')
plt.legend(title='Load')
plt.tight_layout()
plt.show()