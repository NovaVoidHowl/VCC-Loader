!macro customInstall
  DetailPrint "Registering VCC Protocol..."
  WriteRegStr HKCR "vcc" "" "URL:VCC Protocol"
  WriteRegStr HKCR "vcc" "URL Protocol" ""
  WriteRegStr HKCR "vcc\DefaultIcon" "" "$INSTDIR\${APP_FILENAME}.exe,1"
  WriteRegStr HKCR "vcc\shell" "" ""
  WriteRegStr HKCR "vcc\shell\open" "" ""
  WriteRegStr HKCR "vcc\shell\open\command" "" '"$INSTDIR\${APP_FILENAME}.exe" "%1"'
  DetailPrint "VCC Protocol registered."
!macroend

!macro customUnInstall
  DetailPrint "Unregistering VCC Protocol..."
  DeleteRegKey HKCR "vcc"
  DetailPrint "VCC Protocol unregistered."
!macroend
