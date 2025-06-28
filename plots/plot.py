import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

# Data for Throughput
scenarios = ['Lower-Capacity', 'Higher-Capacity Local', 'Very Slow Ramp-up']
average_tps = [26.40, 79.17, 22.70]
peak_tps = [60.00, 320.00, 40.00]

x = np.arange(len(scenarios)) # Label locations
width = 0.35 # Width of the bars

fig, ax = plt.subplots(figsize=(10, 6))
rects1 = ax.bar(x - width/2, average_tps, width, label='Average Confirmed TPS', color='skyblue')
rects2 = ax.bar(x + width/2, peak_tps, width, label='Peak Confirmed TPS', color='lightcoral')

# Add some text for labels, title and custom x-axis tick labels, etc.
ax.set_ylabel('Transactions Per Second (TPS)')
ax.set_title('Achieved Throughput Across Test Scenarios')
ax.set_xticks(x)
ax.set_xticklabels(scenarios)
ax.legend()
ax.grid(axis='y', linestyle='--', alpha=0.7)

# Optional: Add value labels on top of the bars
def autolabel(rects):
    for rect in rects:
        height = rect.get_height()
        ax.annotate('{}'.format(height),
                    xy=(rect.get_x() + rect.get_width() / 2, height),
                    xytext=(0, 3),  # 3 points vertical offset
                    textcoords="offset points",
                    ha='center', va='bottom')

autolabel(rects1)
autolabel(rects2)

fig.tight_layout()
plt.savefig('throughput_comparison.png')
plt.show()