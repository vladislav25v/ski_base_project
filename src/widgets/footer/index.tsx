import { Link } from 'react-router-dom'
import { getButtonClassName } from '../../shared/ui'
import styles from './Footer.module.scss'

type FooterProps = {
  isAdmin: boolean
  onLogout: () => void
}

export const Footer = ({ isAdmin, onLogout }: FooterProps) => (
  <footer className={styles.footer}>
    {isAdmin ? (
      <button
        className={getButtonClassName({ uppercase: true })}
        type="button"
        onClick={onLogout}
      >
        Выйти
      </button>
    ) : (
      <Link className={getButtonClassName({ uppercase: true })} to="/admin">
        Кнопка директора
      </Link>
    )}
  </footer>
)
