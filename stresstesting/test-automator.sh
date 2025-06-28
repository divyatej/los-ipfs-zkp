#!/bin/bash

# --- Configuration ---
# Define the number of flows for each test run
# IMPORTANT: These should match what your Python script expects to read.
# Ensure your ipfs-fin-test.js script can take this as an argument or is configured to use it.
FLOWS_TO_TEST=(5000) # Add more flow counts as needed (e.g., 2000 5000)

# Directory where your Geth chaindata is located
NODE1_CHAIN_DATA_DIR="/mnt/ethereum_data/node1/geth/chaindata"
NODE2_CHAIN_DATA_DIR="/mnt/ethereum_data/node2/geth/chaindata"

# Log file paths
CPU_MEM_LOG="cpu_mem_log.txt"
MEM_AN_LOG="cpu_mem_an_log.txt"

# Output file for aggregated results (optional, but good for tracking)
RESULTS_SUMMARY="stress_test_summary.log"

# Clear previous summary file for a fresh run
> "$RESULTS_SUMMARY"
echo "Starting automated stress test runs at $(date)" | tee -a "$RESULTS_SUMMARY"
echo "---------------------------------------------------" | tee -a "$RESULTS_SUMMARY"

# Loop through each defined flow count
for flows in "${FLOWS_TO_TEST[@]}"; do
    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "=== Starting Test for ${flows} Flows ===" | tee -a "$RESULTS_SUMMARY"
    echo "Current time: $(date)" | tee -a "$RESULTS_SUMMARY"

    # --- 1. Cleanup previous logs ---
    echo "Cleaning up old sar logs..." | tee -a "$RESULTS_SUMMARY"
    rm -f "$CPU_MEM_LOG" "$MEM_AN_LOG"
    sleep 1 # Give a moment for cleanup

    # --- 2. Start SAR background processes ---
    echo "Starting SAR for CPU monitoring..." | tee -a "$RESULTS_SUMMARY"
    sar -u 5 720 > "$CPU_MEM_LOG" &
    SAR_U_PID=$! # Store PID of sar -u

    echo "Starting SAR for Memory monitoring..." | tee -a "$RESULTS_SUMMARY"
    sar -r 5 720 >> "$MEM_AN_LOG" & # Use >> to append for subsequent runs if needed
    SAR_R_PID=$! # Store PID of sar -r

    echo "SAR PIDs: CPU ($SAR_U_PID), Memory ($SAR_R_PID)" | tee -a "$RESULTS_SUMMARY"
    sleep 2 # Give SAR a moment to start writing to files

    # --- 3. Record Initial Chain Data Disk Usage ---
    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "Initial Chain Data Disk Usage:" | tee -a "$RESULTS_SUMMARY"
    echo "Node 1: $(du -sh "$NODE1_CHAIN_DATA_DIR" 2>/dev/null || echo 'Node1 dir not found/accessible')" | tee -a "$RESULTS_SUMMARY"
    echo "Node 2: $(du -sh "$NODE2_CHAIN_DATA_DIR" 2>/dev/null || echo 'Node2 dir not found/accessible')" | tee -a "$RESULTS_SUMMARY"

    # --- 4. Run the Stress Test (ipfs-fin-test.js) ---
    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "Running ipfs-fin-test.js for ${flows} flows..." | tee -a "$RESULTS_SUMMARY"
    # IMPORTANT: Modify this line if your JS script expects flow count as an argument.
    # E.g., node ipfs-fin-test.js $flows
    # Or ensure your JS script reads from a config or is hardcoded for current test.
    # For this automation, we assume it's running a test corresponding to `flows`.
    node ipfs-fin-test.js
    JS_EXIT_CODE=$? # Capture the exit code of the JS script

    if [ $JS_EXIT_CODE -ne 0 ]; then
        echo "WARNING: ipfs-fin-test.js exited with non-zero code ($JS_EXIT_CODE). Check JavaScript logs." | tee -a "$RESULTS_SUMMARY"
    fi

    echo "ipfs-fin-test.js finished." | tee -a "$RESULTS_SUMMARY"

    # --- 5. Stop SAR background processes ---
    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "Killing SAR processes..." | tee -a "$RESULTS_SUMMARY"
    sudo kill "$SAR_U_PID" "$SAR_R_PID" 2>/dev/null # Suppress error if already dead
    sleep 2 # Give a moment for processes to terminate and logs to finalize

    # --- 6. Record Final Chain Data Disk Usage ---
    echo "Final Chain Data Disk Usage:" | tee -a "$RESULTS_SUMMARY"
    echo "Node 1: $(du -sh "$NODE1_CHAIN_DATA_DIR" 2>/dev/null || echo 'Node1 dir not found/accessible')" | tee -a "$RESULTS_SUMMARY"
    echo "Node 2: $(du -sh "$NODE2_CHAIN_DATA_DIR" 2>/dev/null || echo 'Node2 dir not found/accessible')" | tee -a "$RESULTS_SUMMARY"

    # --- 7. Run CPU and Memory Average Calculation Scripts ---
    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "Running CPU Average Script (cpu_av.sh):" | tee -a "$RESULTS_SUMMARY"
    bash cpu_av.sh | tee -a "$RESULTS_SUMMARY"

    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "Running Memory Used Script (mem_used.sh):" | tee -a "$RESULTS_SUMMARY"
    bash mem_used.sh | tee -a "$RESULTS_SUMMARY"

    echo "=== Test for ${flows} Flows Completed ===" | tee -a "$RESULTS_SUMMARY"
    echo "---------------------------------------------------" | tee -a "$RESULTS_SUMMARY"
    echo "" | tee -a "$RESULTS_SUMMARY"

done

echo "All automated stress tests completed." | tee -a "$RESULTS_SUMMARY"
echo "Review '$RESULTS_SUMMARY' for a summary of results."