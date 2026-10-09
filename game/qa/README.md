# Laya ilə GPU playtest

Bu qovluq oyun üçün ayrıca QA alətidir. Normal `project.godot` oyunu Laya
yükləmir; şəbəkə, AI və hesab tələb etmir. QA yalnız lokal fayllarla əlaqə qurur.

## Başlatmaq

`RunGame.cmd` və ya Godot F5 əvvəlcə rejim menyusunu açır. **NORMAL OYUN** ilə
özün oynayırsan. **LAYA İLƏ BUG TESTİ** lokal CUDA modeli yükləyir və bu demo
üçün ayrıca pəncərə açır. Menyu yüklənmə/nəticə vəziyyətini göstərir və eyni
demonun ikinci dəfə açılmasının qarşısını alır. Demo pəncərəsini bağlayandan
sonra yenidən rejim seçə bilərsən. `LAYA_PYTHON` mühit dəyişəni ilə CUDA
quraşdırılmış Python/virtual mühitin EXE yolunu vermək olar.
Başlatma logu `qa/runs/menu-*/launcher.log` daxilindədir.

Hazırkı kompüterdə NVIDIA CUDA, PyTorch və keşdəki Laya multilingual çəkiləri
istifadə edilir. `RunLayaQA.cmd` normal oyunu model ilə görünən pəncərədə test
edir. `RunLayaBugDemo.cmd` ayrıca demo qüsurunu aktivləşdirir: açarsız qapının
açılması. Normal oyun səhnələri dəyişdirilmir. Bug launcher əvvəl normal
yoxlamaları, sonra qəsdən əlavə edilmiş qapı bugını göstərir və nəticəni açıq
saxlayır. Launcher tam oynama marşrutunu da işlədir: oyunçu açarı toplayır,
yeşiyi itələyir, platformalardan istifadə edir və çıxışa çatır. Yalnız tez qapı
nümayişi üçün `--probes-only` seçimini əlavə edin. Normal oyunu qəsdən bug
əlavə etmədən test etmək üçün `RunLayaQA.cmd` istifadə edin.

Görünən demo standart olaraq **yarım sürətlə** oynayır; qərarlar arasında
0.7 saniyə real fasilə var. `--speed 0.25` daha da yavaşladır. Hər fizika addımı
yenə 1/60 oyun saniyəsidir, ona görə yoxlanılmış tullanışlar qorunur.
`--decision-delay 1.5` ilə qərarlara baxmaq üçün daha uzun fasilə verə bilərsiniz.

Qapı testi E basılmadan əvvəl 3 saniyə dayanır: qırmızı çərçivəli mərkəzi qapı
bağlıdır, oyunçunun inventarı boşdur və açar solda görünür. E-dən sonra demo
qapısı açılır və qələbə verilir. Aşağıdakı **BUG #01** paneli gözlənilən və
müşahidə edilən vəziyyəti göstərir. **REPLAY BUG (slow)** qeydə alınmış testin
yavaş təkrarıdır; ayrıca yeni model qərarı kimi təqdim edilmir.

Bu, `qa/faults/exit_without_key.gd` daxilində açar şərti qəsdən silinmiş real
demo qapısıdır. Normal `scripts/exit_door.gd` qapısı açarı yoxlamağa davam edir.

```powershell
python qa/run_laya.py --device cuda
python qa/run_laya.py --device cuda --headless
python qa/run_laya.py --device cuda --demo --keep-open
python qa/run_laya.py --device cuda --fault door_without_key
python qa/run_laya.py --device cuda --fault ladder_down_blocked
```

CUDA tələb edilir; GPU yoxdursa proqram səhv verir, gizli CPU fallback etmir.
`--device cpu` yalnız ayrıca istənilən CPU testi üçündür. Başqa kompüter üçün
CUDA dəstəkli PyTorch quraşdırın və `python -m pip install -r qa/requirements.txt`
əmrini işlədin. Hazırkı iş qovluğunda Laya 0.3.21 `.tools/laya_sdk` daxilindədir;
digər kompüterlərdə həmin paket seçilmiş Python mühitindən import edilir.

`--model C:\path\to\multilingual` ilə `rl_agent_config.json` və
`model.safetensors` saxlayan lokal model qovluğunu verə bilərsiniz. Standart
olaraq Hugging Face keşindən artıq endirilmiş model seçilir. QA işləyərkən
offline rejimi aktivdir; model çəkiləri avtomatik endirilmir. `--godot PATH`
ilə Godot 4 console EXE yolunu dəyişmək olar.
GitHub-dan götürülmüş versiyada Godot EXE ayrıca quraşdırılmalıdır. QA onu
`GODOT_BIN` mühit dəyişənindən və ya `godot` / `godot4` PATH əmrlərindən də tapır.

## Model nə edir?

Laya həqiqi GPU inference ilə test ssenarisini və hər növbəti hərəkəti seçir.
İlk yoxlamalar: açarsız qapı, ölümdən sonra tam reset, pauza və nərdivəndən
eniş. Sonra model sadə waypoint bələdçisi ilə səviyyəni oynayır: açar, yeşik,
hərəkətli platformalar və çıxış. Modelə ekran şəkli deyil, Godot-dan gələn
koordinatlar və vəziyyətin mətn təsviri verilir.

Waypoint sırası və hərəkət motoru əvvəlcədən verilmişdir. Bu versiya modelin
xəritəni sıfırdan kəşf etdiyini və ya bütün mümkün bugları tapdığını iddia etmir.
Düymə seçimi Laya-dandır; oyun fizikasını Godot işlədir. Modelin qərarsız
qalması, vaxt limitinə çatması və ya səhv hərəkətə görə ölməsi **oyun bugı kimi
qeydə alınmır**. Belə qaçış `inconclusive` göstərilir.

Bug təsdiqi yoxlanılan qaydalara əsaslanır: məsələn, inventarda açar yoxdursa
qapı açılmamalıdır. İzolyasiya olunmuş probe quruluşları test obyektlərini
yerləşdirə bilər; tam qaçış marşrutunda oyunçu teleport edilmir. Dünya model
qərarları arasında dondurulur ki, inference gecikməsi platformanın vaxtını
dəyişdirməsin. Görünən pəncərədə qərar və model ehtimalı göstərilir.

## Hesabat və təkrar

Hər qaçış `qa/runs/<session>/` qovluğunda saxlanır:

- `report.md` — oxunaqlı nəticə və bug dəlili.
- `report.json` — GPU adı, model versiyası, yoxlamalar və son vəziyyət.
- `trace.jsonl` — qərarlar, ehtimallar, inference vaxtı, düymələr, əvvəl/sonra vəziyyət.
- `godot.log` — mühərrik xətaları.
- `evidence.png` — görünən pəncərədə son render.
- `bug-before.png`, `bug-after.png` — E-dən əvvəl və sonra görünən qapı testi.

Qaçışı model yükləmədən təkrar oynatmaq:

```powershell
python qa/run_laya.py --replay qa/runs/SESSION/trace.jsonl --headless
```

Demo qaçışını replay edərkən eyni `--fault` seçimini də verin. Replay yeni
iz yazır; avtomatik frame-by-frame müqayisə bu versiyada yoxdur.

Normal uğurlu qaçış exit code 0, təsdiqlənmiş bug 1, runner problemi 2,
modelin nəticəsiz qaçışı 3 qaytarır. Demo bugları ayrıca qeyd edilir və normal
oyunda aşkar edilmiş səhvlərlə qarışdırılmır.

SDK/API mənbəyi: https://github.com/NandhaKishorM/laya və
https://pypi.org/project/laya/0.3.21/.
