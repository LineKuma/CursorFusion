; ============================================
; CursorFusion NSIS Installer Script
; 使用 makensis 编译
; ============================================

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "WinMessages.nsh"

; ----- 通用设置 -----
Name "CursorFusion"
OutFile "CursorFusion-Setup.exe"
InstallDir "$PROGRAMFILES64\CursorFusion"
InstallDirRegKey HKCU "Software\CursorFusion" ""
RequestExecutionLevel admin
SetCompressor /SOLID lzma
CRCCheck on

; ----- 版本信息 -----
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "CursorFusion"
VIAddVersionKey "CompanyName" "LineCatOvO"
VIAddVersionKey "LegalCopyright "(C) 2024 LineCatOvO"
VIAddVersionKey "FileDescription "CursorFusion Installer"
VIAddVersionKey "FileVersion" "1.0.0.0"

; ----- MUI 界面定义 -----
!define MUI_ICON "assets\icon.ico"
!define MUI_UNICON "assets\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "assets\header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\wizard.bmp"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"

; ----- 安装逻辑 -----
Section "CursorFusion" SecMain
  SetOutPath $INSTDIR

  ; 安装主程序文件
  File /r "dist\*.*"
  File "package.json"

  ; 写入卸载程序
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; 创建开始菜单快捷方式
  CreateDirectory "$SMPROGRAMS\CursorFusion"
  CreateShortcut "$SMPROGRAMS\CursorFusion\CursorFusion.lnk" "$INSTDIR\CursorFusion.exe"
  CreateShortcut "$SMPROGRAMS\CursorFusion\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

  ; 创建桌面快捷方式
  CreateShortcut "$DESKTOP\CursorFusion.lnk" "$INSTDIR\CursorFusion.exe"

  ; 注册安装信息到注册表
  WriteRegStr HKCU "Software\CursorFusion" "" $INSTDIR
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorFusion" \
                 "DisplayName" "CursorFusion"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorFusion" \
                 "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorFusion" \
                 "DisplayIcon" "$INSTDIR\CursorFusion.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorFusion" \
                 "Publisher" "LineCatOvO"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorFusion" \
                  "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorFusion" \
                  "NoRepair" 1

  ; 添加到系统 PATH（可选）
  ${EnvVarUpdate} $0 "PATH" "A" "HKLM" "$INSTDIR"

SectionEnd

; ----- 卸载逻辑 -----
Section "Uninstall"
  ; 删除安装目录下的所有文件
  RMDir /r "$INSTDIR\*.*"

  ; 删除快捷方式
  Delete "$SMPROGRAMS\CursorFusion\CursorFusion.lnk"
  Delete "$SMPROGRAMS\CursorFusion\Uninstall.lnk"
  RMDir "$SMPROGRAMS\CursorFusion"
  Delete "$DESKTOP\CursorFusion.lnk"

  ; 清理注册表
  DeleteRegKey /ifempty HKCU "Software\CursorFusion"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CursorFusion"

  ; 从系统 PATH 移除
  ${un.EnvVarUpdate} $0 "PATH" "R" "HKLM" "$INSTDIR"

SectionEnd
