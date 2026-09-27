; Salary Ticker NSIS 훅 (tauri.conf.json bundle.windows.nsis.installerHooks)

; 제거 후: 자동 실행 흔적 정리. 업데이트(/UPDATE)로 다시 설치하는 중에는 유지한다.
; - Run 값은 Tauri 기본 제거 스크립트도 지우지만, 여기서도 명시적으로 지운다.
; - StartupApproved\Run 값은 작업 관리자 "시작프로그램"의 사용/사용 안 함 상태로, 기본 스크립트가 남긴다.
!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${PRODUCTNAME}"
  ${EndIf}
!macroend
