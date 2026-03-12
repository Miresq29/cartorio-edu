param([string]$ProjectDir = ".")
$ReportFile = "security-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$Pass = 0; $Warn = 0; $Fail = 0
function Write-OK   { param($msg) Write-Host "  [OK]   $msg" -ForegroundColor Green;  $script:Pass++; Add-Content $ReportFile "[OK]    $msg" }
function Write-WARN { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow; $script:Warn++; Add-Content $ReportFile "[WARN]  $msg" }
function Write-FAIL { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $script:Fail++; Add-Content $ReportFile "[FAIL]  $msg" }
function Write-INFO { param($msg) Write-Host "  [INFO] $msg" -ForegroundColor Cyan;   Add-Content $ReportFile "[INFO]  $msg" }
function Write-Section { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Blue; Add-Content $ReportFile "`n=== $msg ===" }
function Cmd-Exists { param($cmd) return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
Set-Location $ProjectDir
$AbsPath = (Get-Location).Path
Clear-Host
Write-Host "SECURITY AUDIT SCRIPT" -ForegroundColor Cyan
Write-Host "Projeto: $AbsPath`n" -ForegroundColor Yellow
"RELATORIO DE SEGURANCA - $(Get-Date)" | Set-Content $ReportFile
"Projeto: $AbsPath" | Add-Content $ReportFile
Write-Section "1 - SECRETS E DADOS SENSIVEIS"
try { $gt = git ls-files 2>$null; if ($gt | Where-Object { $_ -match "^\.env" }) { Write-FAIL ".env esta sendo trackeado pelo Git!" } else { Write-OK ".env nao esta commitado." } } catch { Write-INFO "Git nao disponivel." }
if (Test-Path ".gitignore") { $gi = Get-Content ".gitignore" -Raw; if ($gi -match "\.env") { Write-OK ".gitignore protege .env" } else { Write-WARN ".gitignore nao menciona .env" } } else { Write-FAIL ".gitignore nao encontrado!" }
$exts = @("*.js","*.ts","*.jsx","*.tsx","*.py","*.json","*.yaml","*.yml")
$allFiles = Get-ChildItem -Recurse -Include $exts -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "\\(\.git|node_modules|\.next|dist|build)\\" }
$sf = $false
@{ "Google/Firebase Key"="AIza[0-9A-Za-z\-_]{35}"; "OpenAI Key"="sk-[a-zA-Z0-9]{48}"; "GitHub PAT"="ghp_[0-9a-zA-Z]{36}"; "Chave Privada"="BEGIN (RSA|EC|OPENSSH) PRIVATE KEY" }.GetEnumerator() | ForEach-Object { $r = $allFiles | Select-String -Pattern $_.Value -ErrorAction SilentlyContinue; if ($r) { Write-FAIL "Secret encontrado ($($_.Key)): $($r[0].Filename):$($r[0].LineNumber)"; $sf = $true } }
if (-not $sf) { Write-OK "Nenhum padrao de secret encontrado." }
Write-Section "2 - GIT"
try { $gl = git log -p --all 2>$null | Select-String "password\s*=\s*." -ErrorAction SilentlyContinue; if ($gl) { Write-FAIL "Possiveis secrets no historico do Git!" } else { Write-OK "Historico Git limpo." } } catch {}
if (Test-Path ".gitignore") { $gi = Get-Content ".gitignore" -Raw; $miss = @(); @("node_modules",".env",".next","dist") | % { if ($gi -notmatch [regex]::Escape($_)) { $miss += $_ } }; if ($miss.Count -eq 0) { Write-OK ".gitignore completo." } else { Write-WARN ".gitignore nao cobre: $($miss -join ', ')" } }
Write-Section "3 - NPM AUDIT"
if ((Test-Path "package.json") -and (Cmd-Exists "npm")) { try { $a = npm audit --json 2>$null | ConvertFrom-Json; $c = if($a.metadata.vulnerabilities.critical){$a.metadata.vulnerabilities.critical}else{0}; $h = if($a.metadata.vulnerabilities.high){$a.metadata.vulnerabilities.high}else{0}; $m = if($a.metadata.vulnerabilities.moderate){$a.metadata.vulnerabilities.moderate}else{0}; if($c -gt 0){Write-FAIL "$c vulnerabilidades CRITICAS!"}; if($h -gt 0){Write-FAIL "$h vulnerabilidades ALTAS!"}; if($m -gt 0){Write-WARN "$m vulnerabilidades MODERADAS."}; if($c -eq 0 -and $h -eq 0){Write-OK "Sem criticas/altas."} } catch { Write-WARN "npm audit falhou." } } else { Write-WARN "package.json ou npm nao encontrado." }
Write-Section "4 - CODIGO INSEGURO"
$ev = $allFiles | Select-String "eval\(" | Where-Object { $_ -notmatch "//" }; if($ev.Count -gt 0){Write-FAIL "eval() $($ev.Count)x - risco Code Injection!"}else{Write-OK "Sem eval()."}
$ih = $allFiles | Select-String "innerHTML\s*=" -ErrorAction SilentlyContinue; if($ih.Count -gt 0){Write-WARN "innerHTML $($ih.Count)x - possivel XSS."}else{Write-OK "Sem innerHTML direto."}
$ht = $allFiles | Select-String "http://" | Where-Object { $_ -notmatch "localhost|127\.0\.0\.1" }; if($ht.Count -gt 0){Write-WARN "$($ht.Count) URLs HTTP inseguras."}else{Write-OK "Sem URLs HTTP inseguras."}
$lg = $allFiles | Select-String "console\.log.*(password|token|secret)" -ErrorAction SilentlyContinue; if($lg.Count -gt 0){Write-WARN "$($lg.Count) logs com dados sensiveis."}else{Write-OK "Sem logs sensiveis."}
Write-Section "5 - FIREBASE"
if(Test-Path "firestore.rules"){$fr=Get-Content "firestore.rules" -Raw; if($fr -match "if true"){Write-FAIL "CRITICO: Firestore ABERTO para TODOS!"}elseif($fr -match "auth != null"){Write-OK "Firestore exige autenticacao."}else{Write-WARN "Revise regras do Firestore."}}else{Write-WARN "firestore.rules nao encontrado."}
if(Test-Path "storage.rules"){$sr=Get-Content "storage.rules" -Raw; if($sr -match "if true"){Write-FAIL "CRITICO: Storage ABERTO para TODOS!"}elseif($sr -match "auth != null"){Write-OK "Storage exige autenticacao."}else{Write-WARN "Revise regras do Storage."}}else{Write-WARN "storage.rules nao encontrado."}
if(Test-Path "database.rules.json"){$dr=Get-Content "database.rules.json" -Raw; if($dr -match '"read":\s*true|"write":\s*true'){Write-FAIL "CRITICO: Realtime DB aberto!"}else{Write-OK "Realtime DB sem regras abertas."}}
Write-Section "6 - VERCEL"
if(Test-Path "vercel.json"){$vc=Get-Content "vercel.json" -Raw; if($vc -match '"headers"'){@("X-Frame-Options","Content-Security-Policy","Strict-Transport-Security") | %{if($vc -match $_){Write-OK "Header OK: $_"}else{Write-WARN "Header ausente: $_"}}}else{Write-WARN "Sem headers de seguranca em vercel.json."}}else{Write-WARN "vercel.json nao encontrado."}
if((Test-Path ".env.example") -or (Test-Path ".env.sample")){Write-OK ".env.example presente."}else{Write-WARN "Crie um .env.example sem valores reais."}
Write-Section "7 - AUTENTICACAO"
$jsF = Get-ChildItem -Recurse -Include @("*.js","*.ts") -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "\\(\.git|node_modules|\.next)\\" }
$jwt=$jsF|Select-String "ignoreExpiration:\s*true|verify\s*=\s*false" -EA SilentlyContinue; if($jwt.Count -gt 0){Write-FAIL "JWT inseguro detectado!"}else{Write-OK "JWT sem configs inseguras."}
$cors=$jsF|Select-String "cors\(\)|origin.*\*" -EA SilentlyContinue; if($cors.Count -gt 0){Write-WARN "CORS wildcard (*) detectado - restrinja em producao."}else{Write-OK "CORS sem wildcard obvio."}
$rl=$jsF|Select-String "rateLimit|rate-limit|express-rate-limit" -EA SilentlyContinue; if($rl.Count -gt 0){Write-OK "Rate limiting detectado."}else{Write-WARN "Rate limiting nao detectado."}
Write-Section "8 - ARQUIVOS SENSIVEIS"
$af=$false; @("*.pem","*.key","serviceAccountKey.json","firebase-adminsdk*.json") | %{ $f=Get-ChildItem -Recurse -Filter $_ -EA SilentlyContinue|Where-Object{$_.FullName -notmatch "\\(\.git|node_modules)\\"}; if($f){Write-FAIL "Arquivo sensivel: $($f.Name)"; $af=$true}}; if(-not $af){Write-OK "Sem arquivos de credencial expostos."}
if(Test-Path "package.json"){$pk=Get-Content "package.json" -Raw; if($pk -match '"private":\s*true'){Write-OK '"private":true no package.json.'}else{Write-WARN 'Adicione "private":true ao package.json.'}}
Write-Section "9 - DEPENDENCIAS DESATUALIZADAS"
if((Test-Path "package.json") -and (Cmd-Exists "npm")){try{$od=npm outdated --json 2>$null; if($od -and $od -ne "{}"){$c=($od|ConvertFrom-Json|Get-Member -MemberType NoteProperty).Count; if($c -gt 10){Write-FAIL "$c pacotes desatualizados."}elseif($c -gt 0){Write-WARN "$c pacotes desatualizados."}else{Write-OK "Dependencias atualizadas."}}else{Write-OK "Dependencias atualizadas."}}catch{}}
Write-Section "10 - BOAS PRATICAS"
if((Test-Path "package-lock.json")-or(Test-Path "yarn.lock")-or(Test-Path "pnpm-lock.yaml")){Write-OK "Lockfile presente."}else{Write-WARN "Sem lockfile - execute npm install."}
if(Test-Path "tsconfig.json"){$ts=Get-Content "tsconfig.json" -Raw; if($ts -match '"strict":\s*true'){Write-OK "TypeScript strict mode ativo."}else{Write-WARN 'Ative strict:true no tsconfig.json.'}}
if(Test-Path "README.md"){Write-OK "README.md presente."}else{Write-INFO "Considere adicionar README.md."}
Write-Host "`n================================================" -ForegroundColor Blue
Write-Host "  SUMARIO FINAL" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Blue
Write-Host "  OK   : $Pass" -ForegroundColor Green
Write-Host "  WARN : $Warn" -ForegroundColor Yellow
Write-Host "  FAIL : $Fail" -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Blue
if($Fail -eq 0 -and $Warn -lt 5){Write-Host "  STATUS: BOM - Continue monitorando!" -ForegroundColor Green}elseif($Fail -lt 3){Write-Host "  STATUS: ATENCAO - Corrija os problemas." -ForegroundColor Yellow}else{Write-Host "  STATUS: CRITICO - Acao imediata necessaria!" -ForegroundColor Red}
Write-Host "================================================`n" -ForegroundColor Blue
Write-Host "Relatorio salvo em: $ReportFile" -ForegroundColor Cyan
Add-Content $ReportFile "`n================="; Add-Content $ReportFile "OK=$Pass | WARN=$Warn | FAIL=$Fail"; Add-Content $ReportFile "$(Get-Date)"
