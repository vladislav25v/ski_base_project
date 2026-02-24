import { useRef, useState } from 'react'
import { HistoryContent } from './components/HistoryContent'
import { TeslenkoContent } from './components/TeslenkoContent'
import { useScrollTopVisibility } from './hooks/useScrollTopVisibility'
import { Graduates } from '../graduates'
import { ScrollTopButton } from '../../ui'
import styles from './AboutAccordion.module.scss'

type AccordionSection = {
  title: string
  allowed?: string[]
  forbidden?: string[]
}

const HISTORY_SECTION_INDEX = 3
const TESLENKO_SECTION_INDEX = 4
const ADMISSION_SECTION_INDEX = 2
const GRADUATES_SECTION_INDEX = 5

const SECTIONS: AccordionSection[] = [
  { title: 'Тренерско-преподавательский состав' },
  {
    title: 'Правила поведения на лыжной базе',
    allowed: [
      'Получать удовольствие от катания на лыжах',
      'Улыбаться даже на подъёмах',
      'Надевать лыжи на ноги',
      'Аккуратно обгонять',
      'Использовать палки, чтобы помогать себе ехать, а не выяснять отношения',
      'При падении делать вид, что так и задумано',
      'Слушаться тренеров и сотрудников лыжного комплекса',
      'Подбадривать товарищей фразами «ещё чуть-чуть» (даже если до финиша 5 км)',
      'Делать серьёзное лицо на старте и счастливое на финише',
      'Помнить, что лыжи едут лучше, когда на них стоят',
      'Говорить «я не устал», даже если язык уже на плече',
      'Уважать трассу, инвентарь и друг друга',
    ],
    forbidden: [
      'Приходить с домашними животными без хозяев',
      'Дразнить, подкармливать или будить медведей',
      'Приходить со своим медведем, даже если он «очень воспитанный»',
      'Заниматься охотой',
      'Копать, рыхлить и улучшать трассу по собственному проекту',
      'Выезжать на трассу на автомобилях, квадро-, мото- и монотехнике',
      'Выходить на трассу с детскими колясками',
      'Распивать спиртные напитки и находиться в нетрезвом виде',
      'Разводить костры, жарить шашлыки и устраивать пикники на лыжне',
      'Вырубать деревья, в том числе ради «короткого маршрута»',
      'Ходить по лыжне без лыж',
      'Кататься со спусков на санках, тюбингах, тазиках и прочих аппаратах',
      'Выбрасывать мусор, даже если он «биоразлагаемый и почти незаметный»',
      'Теряться в лесу. Если всё-таки заблудились, спокойно возвращайтесь домой',
      'Пугать белок',
    ],
  },
  { title: 'Информация для поступающих на занятия' },
  { title: 'История основания лыжной базы' },
  { title: 'Тесленко Владимир Власович' },
  { title: 'Выдающиеся выпускники' },
]

export const AboutAccordion = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(0)
  const firstSectionButtonRef = useRef<HTMLButtonElement | null>(null)
  const showScrollTop = useScrollTopVisibility(firstSectionButtonRef)

  return (
    <section className={styles.section}>
      <h1 className={styles.title}>О базе</h1>
      <div className={styles.accordion}>
        {SECTIONS.map((section, index) => {
          const isOpen = activeIndex === index

          return (
            <div
              key={section.title}
              className={`${styles.panel} ${isOpen ? styles.panelOpen : styles.panelClosed}`}
            >
              <button
                ref={index === 0 ? firstSectionButtonRef : null}
                type="button"
                className={styles.panelButton}
                onClick={() => setActiveIndex((current) => (current === index ? null : index))}
                aria-expanded={isOpen}
              >
                <span className={styles.panelTitle}>{section.title}</span>
                <span className={styles.panelMark} aria-hidden="true" />
              </button>
              <div className={styles.panelBodyWrap}>
                <div className={styles.panelBody}>
                  {index === ADMISSION_SECTION_INDEX ? (
                    <div className={styles.rules}>
                      <h3 className={styles.rulesTitle}>
                        Для зачисления ребёнка в секцию необходимо предоставить:
                      </h3>
                      <ol className={styles.rulesList}>
                        <li>
                          <strong>Медицинскую справку.</strong> Справка от педиатра с допуском
                          к занятиям лыжным спортом (отсутствие противопоказаний к физическим
                          нагрузкам).
                        </li>
                        <li>
                          <strong>Заявление от родителей (законных представителей).</strong>{' '}
                          Письменное заявление о зачислении ребёнка в спортивную секцию.
                        </li>
                      </ol>
                      <p className={styles.historyParagraph}>
                        Дополнительную информацию о расписании тренировок, требованиях к
                        экипировке и организационных вопросах можно уточнить у администрации
                        секции по телефону{' '}
                        <a href="tel:+79145969023">+7 914 596-90-23</a>.
                      </p>
                    </div>
                  ) : index === HISTORY_SECTION_INDEX ? (
                    <HistoryContent />
                  ) : index === TESLENKO_SECTION_INDEX ? (
                    <TeslenkoContent />
                  ) : index === GRADUATES_SECTION_INDEX ? (
                    <Graduates />
                  ) : section.allowed && section.forbidden ? (
                    <div className={styles.rules}>
                      <h3 className={styles.rulesTitle}>Разрешено</h3>
                      <ul className={styles.rulesList}>
                        {section.allowed.map((item) => (
                          <li key={`allowed-${item}`}>{item}</li>
                        ))}
                      </ul>

                      <h3 className={styles.rulesTitle}>Запрещено</h3>
                      <ul className={styles.rulesList}>
                        {section.forbidden.map((item) => (
                          <li key={`forbidden-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <ScrollTopButton isVisible={showScrollTop} />
    </section>
  )
}

