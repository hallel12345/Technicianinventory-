import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getCurrentMonthYear } from "@/lib/time";
import { getPublicStorageUrl, getSupabaseAdmin } from "@/lib/services/storage";

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10MB)" }, { status: 400 });
  }

  const { month, year } = getCurrentMonthYear();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${year}/${String(month).padStart(2, "0")}/${session.user.id}/${nanoid()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(getEnv().SUPABASE_STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const upload = await db.fileUpload.create({
    data: {
      bucket: getEnv().SUPABASE_STORAGE_BUCKET,
      path,
      publicUrl: getPublicStorageUrl(path),
      contentType: file.type,
      sizeBytes: file.size,
      uploadedById: session.user.id
    }
  });

  return NextResponse.json({
    id: upload.id,
    path: upload.path,
    publicUrl: upload.publicUrl
  });
}
