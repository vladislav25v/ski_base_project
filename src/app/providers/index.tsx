import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { store } from '../store'

type AppProvidersProps = {
  children: ReactNode
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  return <Provider store={store}>{children}</Provider>
}
