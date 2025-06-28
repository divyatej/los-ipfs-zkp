import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import json
import os

# --- Configuration ---
# Define the number of flows for each test run (ensure you run JS script for each!)
flows_to_test = [500, 1000, 2000, 5000, 10000] # Example flow counts - ENSURE THIS MATCHES YOUR DATA

# Expected method names from your JavaScript script
method_names = [
    'requestUserAccess',
    'grantAccess',
    'approveLoan'
]

# --- MANUAL DATA INPUT SECTION ---
# YOU MUST FILL THESE LISTS WITH DATA COLLECTED MANUALLY FROM YOUR GETH NODE MACHINE.
# The order should correspond to the 'flows_to_test' list.

# Average CPU Usage during each test run (in percentage)
# Example: [25, 45, 70] means 25% CPU for 500 flows, 45% for 1000, 70% for 2000
avg_cpu_usage_data = [14.26, 14.57, 14.69, 15.44, 15.66]

# Average Memory Usage during each test run (in GB)
# Example: [0.5, 0.75, 0.9] means 0.5GB for 500 flows, 0.75GB for 1000, 0.9GB for 2000
# Adjust the unit in the plot label if your data is in MB (e.g., divide by 1024 if using MB).
avg_memory_usage_data = [0.311671, 0.912132, 1.052467, 1.3221, 1.6074]

# Chain Data Disk Usage (in GB) *after* each test run is completed.
# This represents the cumulative size of your blockchain data directory.
# Example: [5.1, 5.2, 5.4] means 5.1GB after 500 flows test, etc.
chain_disk_size_data = [0.0023, 0.0046, 0.0097, 0.023, 0.051]

# --- Data Loading and Aggregation (from JSON & CSV files) ---
all_tps_data = {method: [] for method in method_names}
all_latency_data = {method: [] for method in method_names} # Per-method latency

overall_tps_data = [] # Overall TPS for scalability plot
overall_average_latency_data = [] # Overall average latency for scalability plot
total_duration_data = [] # Total duration information

# NEW: Data for Block and Chain Size metrics
average_block_size_data = []
max_block_size_data = []
average_block_time_data = [] # For Consensus Mechanism Efficiency

print("Loading data from JSON and CSV files...")
for flows in flows_to_test:
    json_file_path = f'results_{flows}_flows.json'
    csv_file_path = f'ipfs_throughput_log_{flows}.csv' # Ensure JS script saves uniquely!

    # Load JSON Data
    if not os.path.exists(json_file_path):
        print(f"Error: JSON file not found: {json_file_path}. Skipping {flows} flows.")
        # Append zeros/defaults for missing data points
        for method in method_names:
            all_tps_data[method].append(0)
            all_latency_data[method].append(0)
        overall_tps_data.append(0)
        overall_average_latency_data.append(0)
        total_duration_data.append(0)
        average_block_size_data.append(0)
        max_block_size_data.append(0)
        average_block_time_data.append(0)
        continue

    with open(json_file_path, 'r') as f:
        data = json.load(f)

    overall_tps_data.append(data['overallTps'])
    overall_average_latency_data.append(data['averageLatencyMs'])
    total_duration_data.append(data['totalDurationSeconds'])
    average_block_size_data.append(data.get('averageBlockSize', 0)) # Get average block size
    max_block_size_data.append(data.get('maxBlockSize', 0))       # Get max block size
    average_block_time_data.append(data.get('averageBlockTimeMs', 0)) # Get average block time

    for method in method_names:
        tps = data['tpsByMethod'].get(method, 0)
        all_tps_data[method].append(tps)
    
    # Load CSV Data for per-method latency
    if not os.path.exists(csv_file_path):
        print(f"Warning: CSV file not found: {csv_file_path}. Per-method latency will be unavailable for {flows} flows.")
        for method in method_names:
            all_latency_data[method].append(0)
    else:
        try:
            df_log = pd.read_csv(csv_file_path)
            avg_latencies_from_csv = df_log[df_log['Status'] == 'SUCCESS'].groupby('Method')['LatencyMs'].mean().to_dict()
            for method in method_names:
                latency_val = avg_latencies_from_csv.get(method, 0)
                all_latency_data[method].append(latency_val)
        except Exception as e:
            print(f"Error reading or processing CSV {csv_file_path}: {e}. Per-method latency unavailable.")
            for method in method_names:
                all_latency_data[method].append(0)
    
    print(f"Loaded data for {flows} flows.")

# --- Plotting Functions ---
# Helper for consistent x-axis labels and bar plotting
x_ticks = np.arange(len(flows_to_test)) 
bar_width = 0.15 
colors = plt.cm.tab10.colors # Use a colormap for distinct colors

def plot_bar_chart(data, title, y_label, filename, per_method=True):
    fig, ax = plt.subplots(figsize=(15, 7))
    all_values = [] # Collect all values for scaling

    if per_method:
        for i, method in enumerate(method_names):
            offset = (i - (len(method_names) - 1) / 2) * bar_width
            method_values = data[method]
            rects = ax.bar(x_ticks + offset, method_values, bar_width, label=method, color=colors[i % len(colors)])
            all_values.extend(method_values) # Add method's values to overall collection
            for rect in rects:
                height = rect.get_height()
                # --- UPDATED ANNOTATION LOGIC ---
                ax.annotate(f'{height:.0f}', # Changed to 0 decimal places for cleaner numbers
                            xy=(rect.get_x() + rect.get_width() / 2, height),
                            xytext=(0, 5),    # Increased vertical offset to 5 points
                            textcoords="offset points",
                            ha='center', va='bottom',
                            fontsize=7)       # Slightly reduced font size
                # You can also add 'rotation=45' here if labels still collide significantly
        ax.legend(title="Method", bbox_to_anchor=(1.05, 1), loc='upper left')
    else:
        all_values.extend(data) # Add overall data to collection
        ax.bar(x_ticks, data, bar_width, color='skyblue') # Simple bar chart for overall
        for i, val in enumerate(data):
            # --- UPDATED ANNOTATION LOGIC ---
            ax.annotate(f'{val:.0f}', # Changed to 0 decimal places
                        xy=(x_ticks[i], val),
                        xytext=(0, 5), # Increased vertical offset
                        textcoords="offset points",
                        ha='center', va='bottom',
                        fontsize=8) # Slightly reduced font size

    ax.set_ylabel(y_label)
    ax.set_title(title)
    ax.set_xticks(x_ticks)
    ax.set_xticklabels([f'{f} Flows' for f in flows_to_test])
    ax.grid(axis='y', linestyle='--', alpha=0.7)

    # --- Dynamic Y-axis Scaling for Bar Charts ---
    if all_values: # Ensure values are not empty
        min_val = min(all_values)
        max_val = max(all_values)

        if max_val == 0 and min_val == 0:
            ax.set_ylim(bottom=0, top=1) # Default for all zeros
        else:
            y_upper_limit = max_val * 1.1
            y_lower_limit = max(0, min_val * 0.9)

            if (y_upper_limit - y_lower_limit) < 0.1:
                y_upper_limit = y_lower_limit + 0.1

            ax.set_ylim(bottom=y_lower_limit, top=y_upper_limit)
    else:
        ax.set_ylim(bottom=0, top=1) # Default for empty data

    fig.tight_layout()
    plt.savefig(filename)
    print(f"Plot saved as '{filename}'")

def plot_line_chart(x_data, y_data, title, x_label, y_label, filename, color='skyblue'):
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(x_data, y_data, marker='o', linestyle='-', color=color, linewidth=2, markersize=8)
    ax.set_title(title)
    ax.set_xlabel(x_label)
    ax.set_ylabel(y_label)
    ax.set_xticks(x_data)
    ax.grid(True, linestyle='--', alpha=0.7)

    # --- Dynamic Y-axis Scaling ---
    if y_data: # Ensure y_data is not empty
        min_val = min(y_data)
        max_val = max(y_data)

        # Calculate a buffer for the y-axis limits
        # If all values are 0, set a default small range
        if max_val == 0 and min_val == 0:
            ax.set_ylim(bottom=0, top=1) # Set a small default range for all zeros
        else:
            # Add a 10% buffer to the max value, but ensure it's not negative
            y_upper_limit = max_val * 1.1
            y_lower_limit = max(0, min_val * 0.9) # Ensure lower limit is not negative, and doesn't cut off data

            # If the range is too small, provide a reasonable minimum visual range
            if (y_upper_limit - y_lower_limit) < 0.1: # If range is less than 0.1 (e.g., all 0.001)
                y_upper_limit = y_lower_limit + 0.1 # Ensure a minimum visible range of 0.1

            ax.set_ylim(bottom=y_lower_limit, top=y_upper_limit)
    else:
        ax.set_ylim(bottom=0, top=1) # Default for empty data

    plt.savefig(filename)
    print(f"Plot saved as '{filename}'")


# --- Generate Plots ---

# Per-Method Throughput (TPS)
plot_bar_chart(all_tps_data, 'Throughput (TPS) per Smart Contract Method Across Test Sizes',
                'Transactions Per Second (TPS)', 'throughput_per_method_comparison.png')

# Per-Method Latency
plot_bar_chart(all_latency_data, 'Average Latency per Smart Contract Method Across Test Sizes',
                'Average Latency (ms)', 'average_latency_per_method_comparison.png')

# Overall TPS Scalability
plot_line_chart(flows_to_test, overall_tps_data, 'Overall Throughput (TPS) Scalability',
                'Number of IPFS Flows (Total Transactions)', 'Overall Transactions Per Second (TPS)',
                'overall_tps_scalability.png', 'skyblue')

# Overall Average Latency Scalability
plot_line_chart(flows_to_test, overall_average_latency_data, 'Overall Average Latency Scalability',
                'Number of IPFS Flows (Total Transactions)', 'Overall Average Latency (ms)',
                'overall_average_latency_scalability.png', 'lightcoral')

# Node CPU Usage Scalability
plot_line_chart(flows_to_test, avg_cpu_usage_data, 'Node CPU Usage Scalability',
                'Number of IPFS Flows (Total Transactions)', 'Average CPU Usage (%)',
                'node_cpu_scalability.png', 'purple')

# Node Memory Usage Scalability
plot_line_chart(flows_to_test, avg_memory_usage_data, 'Node Memory Usage Scalability',
                'Number of IPFS Flows (Total Transactions)', 'Average Memory Usage (GB)',
                'node_memory_scalability.png', 'darkgreen')

# Average Block Size Growth
plot_line_chart(flows_to_test, average_block_size_data, 'Average Block Size Growth',
                'Number of IPFS Flows (Total Transactions)', 'Average Block Size (Bytes)',
                'average_block_size_growth.png', 'darkblue')

# Chain Data Disk Usage Growth
plot_line_chart(flows_to_test, chain_disk_size_data, 'Blockchain Data Disk Usage Growth',
                'Number of IPFS Flows (Total Transactions)', 'Chain Data Disk Usage (GB)',
                'chain_data_disk_usage_growth.png', 'darkred')

# Average Block Time (Consensus Efficiency)
plot_line_chart(flows_to_test, average_block_time_data, 'Average Block Time (Consensus Efficiency)',
                'Number of IPFS Flows (Total Transactions)', 'Average Block Time (ms)',
                'average_block_time_consensus.png', 'orange')


plt.show() # Display all generated plots

# --- Final Results Summary ---
print("\n--- Overall Performance Summary for Each Test Run ---")
for i, flows in enumerate(flows_to_test):
    print(f"\n{flows} Flows Test:")
    print(f"  Overall TPS: {overall_tps_data[i]:.2f}")
    print(f"  Overall Average Latency: {overall_average_latency_data[i]:.2f} ms")
    print(f"  Node Average CPU Usage: {avg_cpu_usage_data[i]:.2f}%")
    print(f"  Node Average Memory Usage: {avg_memory_usage_data[i]:.2f} GB")
    print(f"  Average Block Size: {average_block_size_data[i]:.2f} Bytes")
    print(f"  Chain Disk Usage (After Test): {chain_disk_size_data[i]:.2f} GB")
    print(f"  Average Block Time: {average_block_time_data[i]:.2f} ms")
    print(f"  Total Test Duration: {total_duration_data[i]:.2f} s")