import { useWalletProvider } from "../hooks/useWalletProvider"
import styles from "./WalletError.module.css"

export const WalletError = () => {
  const walletProvider = useWalletProvider()
  const errorMessage = walletProvider?.errorMessage
  const clearError = walletProvider?.clearError
  const isError = !!errorMessage

  return (
    <div
      className={styles.walletError}
      style={isError ? { backgroundColor: "brown" } : {}}
    >
      {isError && (
        <div onClick={clearError}>
          <strong>Error:</strong> {errorMessage}
        </div>
      )}
    </div>
  )
}