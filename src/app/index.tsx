import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, type MapType, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/trails/avatar';
import { GoalSheet, weekGoalPercent } from '@/components/trails/goal-sheet';
import { Onboarding } from '@/components/trails/onboarding';
import { cardShadow, makePalette, type TrailPalette } from '@/components/trails/palette';
import { ProfileScreen } from '@/components/trails/profile-screen';
import { RecordingHud } from '@/components/trails/recording-hud';
import { SaveTrailSheet } from '@/components/trails/save-trail-sheet';
import { TrailPreview } from '@/components/trails/trail-details';
import { TrailList } from '@/components/trails/trail-list';
import { DifficultyPicker, GlassCard, Icon, PrimaryButton, type IconName } from '@/components/trails/ui';
import { useStepCounter } from '@/hooks/use-step-counter';
import { mottoOfTheDay } from '@/lib/achievements';
import { finishMessage } from '@/lib/messages';
import { loadProfile, saveProfile, weekDistanceM, type Profile } from '@/lib/profile';
import { clearDraft, loadDraft, loadTrails, persistTrails, saveDraft } from '@/lib/trail-storage';
import {
  DIFFICULTIES,
  MAX_ACCURACY_M,
  MAX_SPEED_MS,
  allPoints,
  computeStats,
  countPoints,
  estimateSteps,
  formatDate,
  formatDistance,
  formatAltitude,
  formatKm,
  haversine,
  toGpx,
  type Difficulty,
  type TrackPoint,
  type Trail,
} from '@/lib/trails';

type Mode = 'idle' | 'choosing' | 'recording' | 'paused' | 'saving';
type Live = { speedKmh: number | null; altitude: number | null; accuracy: number | null };

const MAP_TYPES: { type: MapType; label: string; icon: IconName }[] =
  Platform.OS === 'android'
    ? [
        { type: 'terrain', label: 'Teren', icon: 'triangle-outline' },
        { type: 'hybrid', label: 'Satelita', icon: 'earth' },
        { type: 'standard', label: 'Mapa', icon: 'map-outline' },
      ]
    : [
        { type: 'standard', label: 'Mapa', icon: 'map-outline' },
        { type: 'hybrid', label: 'Satelita', icon: 'earth' },
        { type: 'mutedStandard', label: 'Spokojna', icon: 'leaf-outline' },
      ];

const DRAFT_SAVE_EVERY_MS = 10_000;
/** Aplikacja nie ma już dolnego paska zakładek. */
const BottomTabInset = 0;

function KeepScreenOn() {
  useKeepAwake();
  return null;
}

function haptic(kind: 'tap' | 'success' | 'warning') {
  if (Platform.OS === 'web') return;
  if (kind === 'tap') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else
    Haptics.notificationAsync(
      kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scheme = useColorScheme();
  const mapRef = useRef<MapView>(null);

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined); // undefined = wczytuję
  const [justOnboarded, setJustOnboarded] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [finishMsg, setFinishMsg] = useState({ title: '', body: '' });
  const c = makePalette(profile?.theme);
  const [region, setRegion] = useState<Region | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // --- nagrywanie ---
  const [mode, setModeState] = useState<Mode>('idle');
  const modeRef = useRef<Mode>('idle');
  const setMode = (m: Mode) => {
    modeRef.current = m;
    setModeState(m);
  };
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [segments, setSegments] = useState<TrackPoint[][]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [activeMs, setActiveMs] = useState(0);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [live, setLive] = useState<Live>({ speedKmh: null, altitude: null, accuracy: null });
  const stepCounter = useStepCounter(mode === 'recording');

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastPointRef = useRef<TrackPoint | null>(null);
  const lastDraftSaveRef = useRef(0);

  // --- mapa ---
  const [follow, setFollow] = useState(true);
  const followRef = useRef(true);
  const [mapTypeIdx, setMapTypeIdx] = useState(0);

  // --- trasy ---
  const [trails, setTrails] = useState<Trail[]>([]);
  const [showList, setShowList] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null); // pełnoekranowy podgląd
  const [highlightId, setHighlightId] = useState<string | null>(null); // trasa podświetlona na mapie
  const preview = trails.find((t) => t.id === previewId) ?? null;
  const highlight = trails.find((t) => t.id === highlightId) ?? null;

  const elapsedMs = activeMs + (resumedAt != null ? now - resumedAt : 0);
  const isTracking = mode === 'recording' || mode === 'paused';
  const stepsEstimated = stepCounter.steps == null;
  const steps = stepCounter.steps ?? estimateSteps(distanceM);

  // ---------- Efekty ----------

  useEffect(() => {
    loadProfile().then(setProfile);
  }, []);

  useEffect(() => {
    if (!profile) return; // o GPS pytamy dopiero po powitaniu
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
      setRegion({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      });
    })();
  }, [profile]);

  useEffect(() => {
    (async () => {
      setTrails(await loadTrails());
      const draft = await loadDraft();
      if (draft && countPoints(draft.segments) > 0) {
        Alert.alert(
          'Niedokończona wyprawa 🥾',
          `Masz nagranie z ${formatDate(draft.savedAt)} (${formatDistance(
            computeStats(draft.segments).distanceM,
          )}). Kontynuować?`,
          [
            { text: 'Odrzuć', style: 'destructive', onPress: () => clearDraft() },
            {
              text: 'Kontynuuj',
              onPress: () => {
                setDifficulty(draft.difficulty);
                setSegments(draft.segments);
                setDistanceM(computeStats(draft.segments).distanceM);
                setActiveMs(draft.elapsedMs);
                stepCounter.restore(draft.sensorSteps ?? 0);
                setResumedAt(null);
                lastPointRef.current = null;
                setMode('paused');
                startWatch();
              },
            },
          ],
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== 'recording') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  useEffect(() => {
    if (!isTracking) return;
    const t = Date.now();
    if (t - lastDraftSaveRef.current < DRAFT_SAVE_EVERY_MS) return;
    lastDraftSaveRef.current = t;
    saveDraft({ difficulty, segments, elapsedMs, sensorSteps: stepCounter.steps, savedAt: t });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, isTracking]);

  useEffect(() => () => watchRef.current?.remove(), []);

  // Systemowy „wstecz” na Androidzie zamyka kolejne warstwy.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showList) {
        setShowList(false);
        return true;
      }
      if (highlightId) {
        exitHighlight();
        return true;
      }
      if (mode === 'choosing') {
        setMode('idle');
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showList, highlightId, mode]);

  // ---------- GPS ----------

  const onLocation = (loc: Location.LocationObject) => {
    const { latitude, longitude, altitude, accuracy, speed } = loc.coords;
    setLive({
      speedKmh: speed != null && speed >= 0 ? speed * 3.6 : null,
      altitude: altitude ?? null,
      accuracy: accuracy ?? null,
    });

    if (modeRef.current !== 'recording') return;
    if (accuracy != null && accuracy > MAX_ACCURACY_M) return;

    const p: TrackPoint = { latitude, longitude, altitude: altitude ?? null, timestamp: loc.timestamp };
    const last = lastPointRef.current;

    if (last) {
      const step = haversine(last, p);
      const dt = (p.timestamp - last.timestamp) / 1000;
      if (dt > 0 && step / dt > MAX_SPEED_MS) return;
      lastPointRef.current = p;
      setDistanceM((d) => d + step);
      setSegments((s) => {
        const copy = s.slice();
        copy[copy.length - 1] = [...copy[copy.length - 1], p];
        return copy;
      });
    } else {
      lastPointRef.current = p;
      setSegments((s) => [...s, [p]]);
    }

    if (followRef.current) {
      mapRef.current?.animateCamera({ center: { latitude, longitude } }, { duration: 600 });
    }
  };

  const startWatch = async () => {
    watchRef.current?.remove();
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 4, timeInterval: 2000 },
      onLocation,
    );
  };

  const stopWatch = () => {
    watchRef.current?.remove();
    watchRef.current = null;
  };

  // ---------- Akcje ----------

  const setFollowing = (v: boolean) => {
    followRef.current = v;
    setFollow(v);
  };

  const startRecording = (d: Difficulty) => {
    haptic('success');
    setDifficulty(d);
    setSegments([]);
    setDistanceM(0);
    setActiveMs(0);
    stepCounter.reset();
    lastPointRef.current = null;
    lastDraftSaveRef.current = 0;
    const t = Date.now();
    setResumedAt(t);
    setNow(t);
    setMode('recording');
    setHighlightId(null);
    setShowList(false);
    setFollowing(true);
    startWatch();
    centerOnMe(17);
  };

  const pause = () => {
    haptic('tap');
    if (resumedAt != null) setActiveMs((a) => a + (Date.now() - resumedAt));
    setResumedAt(null);
    setMode('paused');
    saveDraft({ difficulty, segments, elapsedMs, sensorSteps: stepCounter.steps, savedAt: Date.now() });
  };

  const resume = () => {
    haptic('tap');
    lastPointRef.current = null;
    const t = Date.now();
    setResumedAt(t);
    setNow(t);
    setMode('recording');
    if (!watchRef.current) startWatch();
  };

  const finish = () => {
    if (mode === 'recording') pause();
    if (countPoints(segments) < 2) {
      haptic('warning');
      Alert.alert('Za mało danych', 'Trasa ma mniej niż 2 punkty GPS. Przejdź kawałek dalej albo odrzuć nagranie.', [
        { text: 'Odrzuć', style: 'destructive', onPress: resetRecording },
        { text: 'Wróć', style: 'cancel' },
      ]);
      return;
    }
    setFinishMsg(
      finishMessage(profile?.name ?? '', {
        distanceM,
        elevationGainM: computeStats(segments).elevationGainM,
        steps,
        durationS: elapsedMs / 1000,
        weekDoneM: weekDistanceM(trails),
        weekGoalM: (profile?.weeklyGoalKm ?? 0) * 1000,
      }),
    );
    setMode('saving');
  };

  const resetRecording = () => {
    stopWatch();
    clearDraft();
    setSegments([]);
    setDistanceM(0);
    setActiveMs(0);
    setResumedAt(null);
    stepCounter.reset();
    lastPointRef.current = null;
    setMode('idle');
  };

  const saveTrail = ({ name, notes, difficulty: d }: { name: string; notes: string; difficulty: Difficulty }) => {
    const trail: Trail = {
      id: String(Date.now()),
      name,
      notes,
      difficulty: d,
      segments,
      durationS: elapsedMs / 1000,
      createdAt: segments[0]?.[0]?.timestamp ?? Date.now(),
      ...computeStats(segments),
      steps,
      stepsEstimated,
    };
    const next = [trail, ...trails];
    setTrails(next);
    persistTrails(next);
    haptic('success');
    resetRecording();
    setPreviewId(trail.id);
  };

  const discardRecording = () => {
    Alert.alert('Odrzucić nagranie?', 'Trasa nie zostanie zapisana.', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Odrzuć', style: 'destructive', onPress: resetRecording },
    ]);
  };

  const deleteTrail = (t: Trail) => {
    Alert.alert('Usunąć trasę?', `„${t.name}” zostanie usunięta na zawsze.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: () => {
          const next = trails.filter((x) => x.id !== t.id);
          setTrails(next);
          persistTrails(next);
          setPreviewId(null);
          setHighlightId(null);
        },
      },
    ]);
  };

  const deleteMany = (ids: string[], done: () => void) => {
    if (ids.length === 0) return;
    Alert.alert(
      ids.length === 1 ? 'Usunąć trasę?' : `Usunąć ${ids.length} tras?`,
      'Tej operacji nie można cofnąć.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: () => {
            const next = trails.filter((t) => !ids.includes(t.id));
            setTrails(next);
            persistTrails(next);
            if (highlightId && ids.includes(highlightId)) setHighlightId(null);
            haptic('success');
            done();
          },
        },
      ],
    );
  };

  const shareTrail = async (t: Trail) => {
    try {
      await Share.share({ title: `${t.name}.gpx`, message: toGpx(t) });
    } catch {
      Alert.alert('Nie udało się udostępnić trasy');
    }
  };

  const focusTrail = (t: Trail) => {
    setFollowing(false);
    mapRef.current?.fitToCoordinates(allPoints(t.segments), {
      edgePadding: { top: insets.top + 120, right: 70, bottom: 200 + BottomTabInset, left: 50 },
      animated: true,
    });
  };

  /** Kliknięcie trasy (na mapie lub liście) → pełnoekranowy podgląd. */
  const openPreview = (t: Trail) => {
    haptic('tap');
    setShowList(false);
    setHighlightId(t.id);
    setPreviewId(t.id);
  };

  const closePreview = () => {
    setPreviewId(null);
    exitHighlight();
  };

  const showOnMap = (t: Trail) => {
    setPreviewId(null);
    setHighlightId(t.id);
    setTimeout(() => focusTrail(t), 350);
  };

  const exitHighlight = () => {
    setHighlightId(null);
    centerOnMe();
  };

  const centerOnMe = async (zoom = 15) => {
    setFollowing(true);
    try {
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
      mapRef.current?.animateCamera(
        { center: { latitude: pos.coords.latitude, longitude: pos.coords.longitude }, zoom },
        { duration: 700 },
      );
    } catch {
      // brak sygnału – zostajemy, gdzie jesteśmy
    }
  };

  // ---------- Ekrany pomocnicze ----------

  if (profile === undefined) {
    return <LinearGradient colors={c.night} style={{ flex: 1 }} />;
  }

  if (profile === null) {
    return (
      <Onboarding
        palette={c}
        onDone={(p) => {
          const full: Profile = { ...p, theme: 'forest', avatar: null, joinedAt: Date.now() };
          saveProfile(full);
          setJustOnboarded(true);
          setProfile(full);
        }}
      />
    );
  }

  if (permissionDenied) {
    return (
      <LinearGradient colors={c.night} style={styles.center}>
        <Text style={{ fontSize: 64 }}>🧭</Text>
        <Text style={[styles.centerTitle, { color: c.text }]}>Bez GPS nie wyruszymy</Text>
        <Text style={[styles.centerText, { color: c.subtext }]}>
          Włącz lokalizację dla aplikacji – tylko tak zapiszę Twoją trasę, kilometry i kroki.
        </Text>
        <PrimaryButton title="Otwórz ustawienia" icon="settings-outline" gradient={c.sunrise} onPress={() => Linking.openSettings()} large />
      </LinearGradient>
    );
  }

  if (!region) {
    return (
      <LinearGradient colors={c.night} style={styles.center}>
        <Text style={{ fontSize: 64 }}>⛰️</Text>
        <Text style={[styles.centerTitle, { color: c.text }]}>Cześć, {profile.name}!</Text>
        <Text style={[styles.centerText, { color: c.subtext }]}>{mottoOfTheDay()}</Text>
        <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 12 }} />
        <Text style={[styles.loading, { color: c.subtext }]}>Łapię sygnał GPS…</Text>
      </LinearGradient>
    );
  }

  // ---------- Render ----------

  const bottom = insets.bottom + BottomTabInset + 12;
  const recColor = DIFFICULTIES[difficulty].color;
  const firstPoint = segments[0]?.[0];
  const highlightPoints = highlight ? allPoints(highlight.segments) : [];
  const liveGain = isTracking ? computeStats(segments).elevationGainM : 0;

  return (
    <View style={styles.container}>
      {isTracking && <KeepScreenOn />}

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        mapType={MAP_TYPES[mapTypeIdx].type}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale
        userInterfaceStyle={scheme === 'dark' ? 'dark' : 'light'}
        onPanDrag={() => followRef.current && setFollowing(false)}>
        {/* zapisane szlaki: biała obwódka + gruba kolorowa linia */}
        {trails.map((t) => {
          const isHi = t.id === highlightId;
          const dim = highlightId != null && !isHi;
          return t.segments.map((seg, i) =>
            seg.length > 1 ? (
              <Polyline
                key={`${t.id}-o${i}`}
                coordinates={seg}
                strokeColor={dim ? '#FFFFFF55' : '#FFFFFF'}
                strokeWidth={isHi ? 13 : 10}
                zIndex={isHi ? 2 : 1}
                tappable
                onPress={() => openPreview(t)}
              />
            ) : null,
          );
        })}
        {trails.map((t) => {
          const isHi = t.id === highlightId;
          const dim = highlightId != null && !isHi;
          const color = DIFFICULTIES[t.difficulty].color;
          return t.segments.map((seg, i) =>
            seg.length > 1 ? (
              <Polyline
                key={`${t.id}-${i}`}
                coordinates={seg}
                strokeColor={dim ? color + '55' : color}
                strokeWidth={isHi ? 8 : 6}
                zIndex={isHi ? 3 : 2}
                tappable
                onPress={() => openPreview(t)}
              />
            ) : null,
          );
        })}

        {/* pinezka z trudnością + podpis trasy na jej starcie */}
        {!isTracking &&
          trails.map((t) => {
            const start = t.segments.find((sg) => sg.length > 0)?.[0];
            if (!start) return null;
            const dim = highlightId != null && t.id !== highlightId;
            return (
              <Marker
                key={`pin-${t.id}`}
                coordinate={start}
                anchor={{ x: 0.5, y: 1 }}
                zIndex={dim ? 4 : 6}
                opacity={dim ? 0.45 : 1}
                onPress={() => openPreview(t)}>
                <TrailPin trail={t} />
              </Marker>
            );
          })}

        {highlight && highlightPoints.length > 0 && (
          <>
            <Marker coordinate={highlightPoints[highlightPoints.length - 1]} anchor={{ x: 0.5, y: 0.5 }} title="Meta">
              <View style={[styles.pin, { backgroundColor: '#16191A' }]}>
                <Text style={{ fontSize: 13 }}>🏁</Text>
              </View>
            </Marker>
          </>
        )}

        {segments.map((seg, i) =>
          seg.length > 1 ? <Polyline key={`rec-o-${i}`} coordinates={seg} strokeColor="#FFFFFF" strokeWidth={11} zIndex={3} /> : null,
        )}
        {segments.map((seg, i) =>
          seg.length > 1 ? <Polyline key={`rec-${i}`} coordinates={seg} strokeColor={recColor} strokeWidth={7} zIndex={4} /> : null,
        )}
        {isTracking && firstPoint && (
          <Marker coordinate={firstPoint} anchor={{ x: 0.5, y: 0.5 }} title="Start">
            <View style={[styles.startPin, { backgroundColor: recColor }]}>
              <Text style={styles.startText}>START</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* przyciemnienie u góry – tekst zawsze czytelny */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        style={[styles.topShade, { height: insets.top + 140 }]}
        pointerEvents="none"
      />

      {/* ---- Górny pasek ---- */}
      <View style={[styles.topArea, { top: insets.top + 8 }]}>
        {highlight && !isTracking ? (
          <GlassCard palette={c} style={styles.topBar}>
            <View style={[styles.topIcon, { backgroundColor: DIFFICULTIES[highlight.difficulty].color }]}>
              <Text style={{ fontSize: 18 }}>{DIFFICULTIES[highlight.difficulty].emoji}</Text>
            </View>
            <Pressable style={{ flex: 1 }} onPress={() => setPreviewId(highlight.id)}>
              <Text style={[styles.topTitle, { color: c.text }]} numberOfLines={1}>
                {highlight.name}
              </Text>
              <Text style={[styles.topSub, { color: c.subtext }]}>
                {formatKm(highlight.distanceM)} km · dotknij, by zobaczyć szczegóły
              </Text>
            </Pressable>
            <Pressable onPress={exitHighlight} hitSlop={10} style={[styles.exitBtn, { backgroundColor: c.cardAlt }]} accessibilityLabel="Wyjdź z podglądu trasy">
              <Icon name="close" size={16} color={c.text} />
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 13 }}>Wyjdź</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <GlassCard palette={c} style={styles.topBar}>
            <Pressable onPress={() => !isTracking && setShowProfile(true)} accessibilityLabel="Profil">
              <Avatar name={profile.name} avatar={profile.avatar} size={42} palette={c} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.topTitle, { color: c.text }]} numberOfLines={1}>
                {isTracking
                  ? `Dawaj, ${profile.name}! 💪`
                  : justOnboarded
                    ? `Miło Cię poznać, ${profile.name}!`
                    : `Witaj z powrotem, ${profile.name} 👋`}
              </Text>
              <Text style={[styles.topSub, { color: c.subtext }]} numberOfLines={1}>
                {isTracking
                  ? `wys. ${formatAltitude(live.altitude)} · GPS ±${live.accuracy != null ? Math.round(live.accuracy) : '—'} m`
                  : mottoOfTheDay()}
              </Text>
            </View>
            {isTracking ? (
              <GpsBadge accuracy={live.accuracy} />
            ) : (
              <Pressable
                onPress={() => {
                  haptic('tap');
                  setShowList((v) => !v);
                }}
                style={[styles.listBtn, { backgroundColor: c.cardAlt }]}
                accessibilityLabel="Moje trasy">
                <Icon name={showList ? 'close' : 'list'} size={18} color={c.text} />
                {!showList && trails.length > 0 && (
                  <View style={[styles.count, { backgroundColor: c.accent }]}>
                    <Text style={[styles.countText, { color: c.onAccent }]}>{trails.length}</Text>
                  </View>
                )}
              </Pressable>
            )}
          </GlassCard>
        )}

        {showList && !isTracking && (
          <TrailList
            trails={trails}
            palette={c}
            onSelect={openPreview}
            onClose={() => setShowList(false)}
            onDeleteMany={deleteMany}
            maxHeight={windowHeight - insets.top - bottom - 120}
          />
        )}
      </View>

      {/* ---- Przyciski mapy ---- */}
      {!showList && (
        <View style={[styles.mapControls, { top: insets.top + 96 }]}>
          <MapButton
            palette={c}
            icon={MAP_TYPES[mapTypeIdx].icon}
            label={MAP_TYPES[mapTypeIdx].label}
            onPress={() => {
              haptic('tap');
              setMapTypeIdx((i) => (i + 1) % MAP_TYPES.length);
            }}
          />
          {!isTracking && (
            <MapButton
              palette={c}
              icon="trophy-outline"
              label={`Cel ${Math.min(999, weekGoalPercent(trails, profile.weeklyGoalKm))}%`}
              onPress={() => {
                haptic('tap');
                setShowGoal(true);
              }}
            />
          )}
          <MapButton
            palette={c}
            icon={follow ? 'navigate' : 'locate'}
            label={follow ? 'Śledzę' : 'Ja'}
            active={follow}
            onPress={() => {
              haptic('tap');
              centerOnMe();
            }}
          />
        </View>
      )}

      {/* ---- Dolny panel ---- */}
      {!showList && (
        <View style={[styles.bottomPanel, { bottom }]}>
          {mode === 'idle' && !highlight && (
            <PrimaryButton
              title="Dodaj trasę"
              icon="add"
              gradient={c.sunrise}
              large
              onPress={() => {
                haptic('tap');
                setMode('choosing');
              }}
            />
          )}

          {mode === 'idle' && highlight && (
            <View style={styles.row}>
              <PrimaryButton title="Szczegóły trasy" icon="stats-chart" gradient={DIFFICULTIES[highlight.difficulty].gradient} onPress={() => setPreviewId(highlight.id)} flex large />
              <PrimaryButton title="Wyjdź" icon="close" color={c.card} onPress={exitHighlight} large />
            </View>
          )}

          {mode === 'choosing' && (
            <GlassCard palette={c} style={styles.chooseCard}>
              <View>
                <Text style={[styles.chooseTitle, { color: c.text }]}>Jaki szlak dziś? 🎒</Text>
                <Text style={[styles.chooseSub, { color: c.subtext }]}>
                  Wybierz kolor trasy – nagrywanie ruszy od razu. Zmienisz go przy zapisie.
                </Text>
              </View>
              <DifficultyPicker value={null} onChange={startRecording} />
              <Pressable onPress={() => setMode('idle')} hitSlop={8} style={styles.cancelBtn}>
                <Text style={[styles.cancel, { color: c.subtext }]}>Anuluj</Text>
              </Pressable>
            </GlassCard>
          )}

          {isTracking && (
            <RecordingHud
              palette={c}
              paused={mode === 'paused'}
              difficulty={difficulty}
              distanceM={distanceM}
              elapsedS={elapsedMs / 1000}
              steps={steps}
              stepsEstimated={stepsEstimated}
              gainM={liveGain}
              onPause={pause}
              onResume={resume}
              onFinish={finish}
            />
          )}
        </View>
      )}

      <SaveTrailSheet
        visible={mode === 'saving'}
        palette={c}
        segments={segments}
        durationS={elapsedMs / 1000}
        steps={steps}
        stepsEstimated={stepsEstimated}
        initialDifficulty={difficulty}
        defaultName={`Wyprawa ${formatDate(segments[0]?.[0]?.timestamp ?? Date.now())}`}
        message={finishMsg}
        onSave={saveTrail}
        onDiscard={discardRecording}
        onResume={resume}
      />

      <ProfileScreen
        visible={showProfile}
        profile={profile}
        trails={trails}
        onClose={() => setShowProfile(false)}
        onSave={(p) => {
          saveProfile(p);
          setProfile(p);
          setShowProfile(false);
          haptic('success');
        }}
      />

      <GoalSheet
        visible={showGoal}
        trails={trails}
        profile={profile}
        palette={c}
        onClose={() => setShowGoal(false)}
        onEditGoal={() => {
          setShowGoal(false);
          setTimeout(() => setShowProfile(true), 350);
        }}
      />

      <TrailPreview
        trail={preview}
        palette={c}
        onClose={closePreview}
        onShowOnMap={() => preview && showOnMap(preview)}
        onShare={() => preview && shareTrail(preview)}
        onDelete={() => preview && deleteTrail(preview)}
      />
    </View>
  );
}

// ---------- Małe komponenty ----------

function MapButton({
  palette: c,
  icon,
  label,
  active,
  onPress,
}: {
  palette: TrailPalette;
  icon: IconName;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.mapButton,
        { backgroundColor: active ? c.accent : c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <Icon name={icon} size={20} color={active ? c.onAccent : c.text} />
      <Text style={[styles.mapButtonLabel, { color: active ? c.onAccent : c.subtext }]}>{label}</Text>
    </Pressable>
  );
}

/** Pinezka w kolorze trudności + nazwa trasy – łatwo znaleźć szlak na mapie. */
function TrailPin({ trail }: { trail: Trail }) {
  const info = DIFFICULTIES[trail.difficulty];
  return (
    <View style={styles.trailPin}>
      <View style={[styles.trailLabel, { borderColor: info.color }]}>
        <Text style={styles.trailLabelName} numberOfLines={1}>
          {trail.name}
        </Text>
        <Text style={[styles.trailLabelKm, { color: info.color }]}>{formatKm(trail.distanceM)} km</Text>
      </View>
      <View style={[styles.pinHead, { backgroundColor: info.color }]}>
        <Text style={styles.pinEmoji}>{info.emoji}</Text>
      </View>
      <View style={[styles.pinTail, { borderTopColor: info.color }]} />
    </View>
  );
}

function GpsBadge({ accuracy }: { accuracy: number | null }) {
  const color =
    accuracy == null ? '#93A79F' : accuracy <= 10 ? '#3DDC97' : accuracy <= MAX_ACCURACY_M ? '#FFB547' : '#FF4D63';
  const bars = accuracy == null ? 0 : accuracy <= 10 ? 3 : accuracy <= MAX_ACCURACY_M ? 2 : 1;
  return (
    <View style={styles.gps}>
      {[1, 2, 3].map((b) => (
        <View
          key={b}
          style={[styles.gpsBar, { height: 5 + b * 4, backgroundColor: b <= bars ? color : 'rgba(255,255,255,0.15)' }]}
        />
      ))}
    </View>
  );
}

// ---------- Style ----------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1513' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  centerTitle: { fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  centerText: { fontSize: 16, textAlign: 'center', lineHeight: 23, fontStyle: 'italic' },
  loading: { fontSize: 13, fontWeight: '700' },

  topShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  topArea: { position: 'absolute', left: 14, right: 14, gap: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  topIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '900' },
  topSub: { fontSize: 12.5, marginTop: 1 },
  listBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  count: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#0D1513', fontSize: 10.5, fontWeight: '900' },
  exitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12 },
  gps: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingHorizontal: 6 },
  gpsBar: { width: 4, borderRadius: 2 },

  mapControls: { position: 'absolute', right: 14, gap: 10 },
  mapButton: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    ...cardShadow,
  },
  mapButtonLabel: { fontSize: 9.5, fontWeight: '800' },

  bottomPanel: { position: 'absolute', left: 14, right: 14 },
  row: { flexDirection: 'row', gap: 10 },
  chooseCard: { padding: 16, gap: 14 },
  chooseTitle: { fontSize: 22, fontWeight: '900' },
  chooseSub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  cancelBtn: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 4 },
  cancel: { fontWeight: '800', fontSize: 15 },

  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  startPin: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, borderWidth: 2, borderColor: 'white' },
  startText: { color: 'white', fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
  avatarText: { color: 'white', fontSize: 19, fontWeight: '900' },

  trailPin: { alignItems: 'center' },
  trailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 190,
    backgroundColor: 'rgba(13,21,19,0.92)',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  trailLabelName: { color: 'white', fontSize: 12, fontWeight: '800', flexShrink: 1 },
  trailLabelKm: { fontSize: 11, fontWeight: '900' },
  pinHead: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinEmoji: { fontSize: 15 },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
