import { useWalletProvider } from "../hooks/useWalletProvider"
import styles from "./WalletList.module.css"
import { useWallet } from "../hooks/useWallet"
import MetaMaskGuide from "./MetaMaskGuide"
export const WalletList = () => {
  const walletContext = useWalletProvider()
  if (!walletContext) return null
  
  const { wallets, connectWallet } = walletContext
  const { providers } = useWallet()

  if (!providers || providers.length === 0) {
    return <MetaMaskGuide />
  }
  return (
    <>
      <h2>Wallets Detected:</h2>
      <div className={styles.walletList}>
        {Object.keys(wallets).length > 0 ? (
          Object.values(wallets).map((provider: EIP6963ProviderDetail) => (
            <button
              key={provider.info.uuid}
              onClick={() => connectWallet(provider.info.rdns)}
            >
              <img src={provider.info.icon} alt={provider.info.name} />
              <div>{provider.info.name}</div>
            </button>
          ))
        ) : (
          <div>there are no Announced Providers</div>
        )}
      </div>
    </>
  )
}