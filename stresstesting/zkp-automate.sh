#!/bin/bash

# --- Configuration ---
# Define the number of ZKP flows for each test run.
# IMPORTANT: You MUST manually update the 'numZkpFlows' variable in your
# zkp-test.js script before each run, or modify the JS script to accept
# this value as a command-line argument.
FLOWS_TO_TEST=(500 1000 2000 5000 10000) # Add or remove flow counts as needed

# Path to your ZKP Node.js test script
ZKP_TEST_SCRIPT="zkp-test.js" # Ensure this path is correct

# Directory where your Geth chaindata is located for each node
# Adjust these paths to your actual Geth data directories
NODE1_CHAIN_DATA_DIR="/mnt/ethereum_data/node1/geth/chaindata"
NODE2_CHAIN_DATA_DIR="/mnt/ethereum_data/node2/geth/chaindata" # If you have a second node

# Log file paths for SAR (System Activity Reporter)
CPU_MEM_LOG="zkp_cpu_mem_sar_log.txt"
MEM_AN_LOG="zkp_mem_an_sar_log.txt"

# Output file for aggregated results
RESULTS_SUMMARY="zkp_stress_test_summary.log"

# --- Initialization ---
# Clear previous summary file for a fresh run
> "$RESULTS_SUMMARY"
echo "Starting automated ZKP stress test runs at $(date)" | tee -a "$RESULTS_SUMMARY"
echo "---------------------------------------------------" | tee -a "$RESULTS_SUMMARY"

# Loop through each defined flow count
for flows in "${FLOWS_TO_TEST[@]}"; do
    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "=== Starting Test for ${flows} ZKP Flows ===" | tee -a "$RESULTS_SUMMARY"
    echo "Current time: $(date)" | tee -a "$RESULTS_SUMMARY"

    # --- 1. Cleanup previous logs ---
    echo "Cleaning up old sar logs..." | tee -a "$RESULTS_SUMMARY"
    rm -f "$CPU_MEM_LOG" "$MEM_AN_LOG"
    sleep 1 # Give a moment for cleanup

    # --- 2. Start SAR background processes ---
    echo "Starting SAR for CPU monitoring..." | tee -a "$RESULTS_SUMMARY"
    # Captures CPU usage every 5 seconds, up to 720 samples (60 minutes)
    sar -u 5 720 > "$CPU_MEM_LOG" &
    SAR_U_PID=$! # Store PID of sar -u

    echo "Starting SAR for Memory monitoring..." | tee -a "$RESULTS_SUMMARY"
    # Captures memory usage every 5 seconds, up to 720 samples (60 minutes)
    sar -r 5 720 >> "$MEM_AN_LOG" & # Use >> to append for subsequent runs if needed
    SAR_R_PID=$! # Store PID of sar -r

    echo "SAR PIDs: CPU ($SAR_U_PID), Memory ($SAR_R_PID)" | tee -a "$RESULTS_SUMMARY"
    sleep 2 # Give SAR a moment to start writing to files

    # --- 3. Record Initial Chain Data Disk Usage ---
    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "Initial Chain Data Disk Usage:" | tee -a "$RESULTS_SUMMARY"
    # '2>/dev/null' suppresses errors if directory doesn't exist.
    # '|| echo ...' provides a fallback message.
    echo "Node 1: $(du -sh "$NODE1_CHAIN_DATA_DIR" 2>/dev/null || echo 'Node1 dir not found/accessible')" | tee -a "$RESULTS_SUMMARY"
    echo "Node 2: $(du -sh "$NODE2_CHAIN_DATA_DIR" 2>/dev/null || echo 'Node2 dir not found/accessible')" | tee -a "$RESULTS_SUMMARY"

    # --- 4. Run the ZKP Stress Test (zkp-test.js) ---
    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "Running ${ZKP_TEST_SCRIPT} for ${flows} flows..." | tee -a "$RESULTS_SUMMARY"
    
    # IMPORTANT: You need to ensure your zkp-test.js script is configured
    # to use the current 'flows' value. There are two main ways:
    # 1. Manually edit zkp-test.js: Change `const numZkpFlows = X;` for each run.
    # 2. Modify zkp-test.js to accept arguments:
    #    E.g., `node zkp-test.js $flows` (and update JS to read `process.argv[2]`).
    #    For this script, we assume method 1 or a hardcoded value in JS that you'll change.
    
    # If your JS script can accept an argument, uncomment and use the line below:
    # node "$ZKP_TEST_SCRIPT" "$flows"
    
    # If your JS script is hardcoded and you'll manually change `numZkpFlows`:
    # You MUST change the `numZkpFlows` variable in `zkp-test.js` to $flows
    # before running this automation for each iteration.
    node "$ZKP_TEST_SCRIPT"
    JS_EXIT_CODE=$? # Capture the exit code of the JS script

    if [ $JS_EXIT_CODE -ne 0 ]; then
        echo "WARNING: ${ZKP_TEST_SCRIPT} exited with non-zero code ($JS_EXIT_CODE). Check JavaScript logs." | tee -a "$RESULTS_SUMMARY"
    fi

    echo "${ZKP_TEST_SCRIPT} finished." | tee -a "$RESULTS_SUMMARY"

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
    # These are placeholder names; ensure you have actual scripts (e.g., cpu_av.sh, mem_used.sh)
    # that parse the SAR logs (zkp_cpu_mem_sar_log.txt, zkp_mem_an_sar_log.txt)
    # and print out the average CPU and memory usage.
    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "Running CPU Average Script (cpu_av.sh):" | tee -a "$RESULTS_SUMMARY"
    # Ensure cpu_av.sh reads from "$CPU_MEM_LOG"
    bash cpu_av.sh | tee -a "$RESULTS_SUMMARY"

    echo "" | tee -a "$RESULTS_SUMMARY"
    echo "Running Memory Used Script (mem_used.sh):" | tee -a "$RESULTS_SUMMARY"
    # Ensure mem_used.sh reads from "$MEM_AN_LOG"
    bash mem_used.sh | tee -a "$RESULTS_SUMMARY"

    echo "=== Test for ${flows} ZKP Flows Completed ===" | tee -a "$RESULTS_SUMMARY"
    echo "---------------------------------------------------" | tee -a "$RESULTS_SUMMARY"
    echo "" | tee -a "$RESULTS_SUMMARY"

done

echo "All automated ZKP stress tests completed." | tee -a "$RESULTS_SUMMARY"
echo "Review '$RESULTS_SUMMARY' for a summary of results."
echo "Also check the generated JSON and CSV files from ${ZKP_TEST_SCRIPT} for detailed metrics."