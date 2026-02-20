import { Button } from '../../shared/ui'
import styles from './Header.module.scss'

type HeaderProps = {
  menuOpen: boolean
  onMenuToggle: () => void
}

export const Header = ({ menuOpen, onMenuToggle }: HeaderProps) => {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <p className={styles.subtitle}>Тында</p>
        <h2 className={styles.brand}>ЛЫЖНАЯ БАЗА ДЮСШ №1</h2>
      </div>
      <img className={styles.logoMark} src="/logo.png" alt="Логотип лыжной базы" />
      <Button
        className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ''}`}
        size="square"
        aria-expanded={menuOpen}
        aria-controls="site-menu"
        onClick={onMenuToggle}
      >
        <span>меню</span>
      </Button>
    </header>
  )
}
