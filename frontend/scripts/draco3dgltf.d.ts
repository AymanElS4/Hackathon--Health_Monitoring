// draco3dgltf ships without TypeScript types. Only its Node decoder factory is used (check-model.ts).
declare module 'draco3dgltf' {
  const draco3d: {
    createDecoderModule(object?: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  export default draco3d;
}
