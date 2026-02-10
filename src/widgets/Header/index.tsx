import { Button } from '../../shared/ui'
import styles from './Header.module.scss'

type HeaderProps = {
  menuOpen: boolean
  onMenuToggle: () => void
}

export const Header = ({ menuOpen, onMenuToggle }: HeaderProps) => {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>ЛЫЖНАЯ БАЗА ДЮСШ №1</div>
      <Button
        className={styles.burger}
        size="square"
        aria-expanded={menuOpen}
        aria-controls="site-menu"
        onClick={onMenuToggle}
      >
        <span className={styles.burgerLine} />
        <span className={styles.burgerLine} />
        <span className={styles.burgerLine} />
      </Button>
    </header>
  )
}
