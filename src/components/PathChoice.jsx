import { SAMPLE_LEVELS, sampleLabel } from '../data/freePreviews.js'
import { useLang } from '../i18n/useLang.js'
import { Button, Screen, TopBar } from './ui.jsx'

export function PathChoice({ choosingLevel, onBeginner, onChooseLevel, onSample, onTest, onBack }) {
  const { t } = useLang()
  return (
    <Screen>
      <TopBar onBack={onBack} title={t('path.title')} bordered />
      <div className="flex flex-1 flex-col gap-4 px-5 py-8">
        <h1 className="text-[28px] font-medium text-fg">{t(choosingLevel ? 'path.chooseLevel' : 'path.chooseProfile')}</h1>
        <p className="mb-2 text-fg-2">{t(choosingLevel ? 'path.levelIntro' : 'path.profileIntro')}</p>
        {choosingLevel ? (
          <>
            <Button onClick={onTest}>{t('path.takeTest')}</Button>
            <div className="grid grid-cols-2 gap-3">
              {SAMPLE_LEVELS.map(level => (
                <Button key={level} variant="secondary" onClick={() => onSample(level, 'direct')}>{sampleLabel(level)}</Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <Button onClick={onBeginner}>{t('path.beginner')}</Button>
            <Button variant="secondary" onClick={onChooseLevel}>{t('path.experienced')}</Button>
          </>
        )}
      </div>
    </Screen>
  )
}
