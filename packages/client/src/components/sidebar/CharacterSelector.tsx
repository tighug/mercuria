import { useCharacterStore } from "../../stores/characterStore";

export function CharacterSelector() {
  const { characters, selectedCharacter, selectCharacter } = useCharacterStore();
  return (
    <div className="flex flex-col gap-2 p-2">
      {characters.map((char) => (
        <button
          key={char.id}
          onClick={() => selectCharacter(char)}
          className={`rounded-full p-2 text-sm transition ${
            selectedCharacter?.id === char.id ? "bg-indigo-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
          title={char.name}
        >
          {char.name[0]}
        </button>
      ))}
    </div>
  );
}
