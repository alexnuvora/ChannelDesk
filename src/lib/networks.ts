export const NETWORKS = ["youtube","tiktok","instagram","facebook","linkedin","x","threads","bluesky","pinterest","google_business","twitch"] as const;
export type Network = (typeof NETWORKS)[number];

export type PublishState = "draft"|"pending_approval"|"scheduled"|"publishing"|"published"|"failed"|"cancelled"|"needs_review";

export interface SocialConnection {
 id:string; workspaceId:string; network:Network; externalAccountId:string; displayName:string; tokenCiphertext:string; tokenExpiresAt?:string; scopes:string[]; active:boolean;
}

export interface Publication {
 id:string; workspaceId:string; text:string; mediaIds:string[]; networks:Network[]; scheduledFor?:string; state:PublishState; createdBy:string;
}
