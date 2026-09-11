import os
import sys
import json
import shutil
import time
from datetime import datetime

def check_hardware():
    print("==================================================")
    print("HARDWARE & AI ENVIRONMENT PROBE")
    print("==================================================")
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        print(f"PyTorch Version: {torch.__version__}")
        print(f"GPU Available: {'YES' if cuda_available else 'NO'}")
        if cuda_available:
            gpu_name = torch.cuda.get_device_name(0)
            cuda_ver = torch.version.cuda
            print(f"GPU Name: {gpu_name}")
            print(f"CUDA Version: {cuda_ver}")
            print(f"Device Count: {torch.cuda.device_count()}")
            return "0"
        else:
            print("Running on CPU.")
            return "cpu"
    except Exception as e:
        print(f"Error checking PyTorch/CUDA: {e}")
        return "cpu"


def main():
    device = check_hardware()

    import ultralytics
    from ultralytics import YOLO
    print(f"Ultralytics Version: {ultralytics.__version__}")

    # Dataset configuration: official Ultralytics Construction-PPE dataset
    dataset_name = "construction-ppe.yaml"
    print(f"\nTarget Dataset: {dataset_name}")

    # Select lightweight pretrained checkpoint
    base_checkpoint = "yolo11n.pt"
    print(f"Base Pretrained Model: {base_checkpoint}")

    print("\n--- 1. Loading Pretrained Model ---")
    model = YOLO(base_checkpoint)

    # Output directory outside Git tracking
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ai", "runs")
    weights_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ai", "weights")
    os.makedirs(weights_dir, exist_ok=True)

    # Fine-tuning parameters
    # Smoke-test / efficient fine-tune suitable for local hardware
    epochs = 3
    imgsz = 416
    batch = 16
    workers = 4

    print("\n--- 2. Starting Fine-Tuning ---")
    print(f"Epochs: {epochs} | Batch: {batch} | ImgSz: {imgsz} | Device: {device} | Workers: {workers}")
    start_train_time = time.time()

    train_results = model.train(
        data=dataset_name,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        workers=workers,
        project=output_dir,
        name="construction_ppe",
        exist_ok=True,
        plots=False,
        save=True,
        verbose=True
    )

    training_duration_sec = round(time.time() - start_train_time, 2)
    print(f"\nTraining completed in {training_duration_sec}s")

    print("\n--- 3. Identifying Best Weights ---")
    best_weights_path = os.path.join(output_dir, "construction_ppe", "weights", "best.pt")
    if not os.path.exists(best_weights_path):
        # Fallback to last.pt if best.pt not generated
        best_weights_path = os.path.join(output_dir, "construction_ppe", "weights", "last.pt")

    target_best_path = os.path.join(weights_dir, "best.pt")
    if os.path.exists(best_weights_path):
        shutil.copy2(best_weights_path, target_best_path)
        print(f"Copied best model to: {target_best_path} ({os.path.getsize(target_best_path)} bytes)")
    else:
        print(f"Warning: Could not find weights at {best_weights_path}")

    print("\n--- 4. Running Model Validation ---")
    val_model = YOLO(target_best_path if os.path.exists(target_best_path) else base_checkpoint)
    val_metrics = val_model.val(
        data=dataset_name,
        device=device,
        imgsz=imgsz,
        batch=batch,
        verbose=False
    )

    # Extract real validation metrics
    precision = round(float(val_metrics.results_dict.get("metrics/precision(B)", 0.0)), 4)
    recall = round(float(val_metrics.results_dict.get("metrics/recall(B)", 0.0)), 4)
    map50 = round(float(val_metrics.results_dict.get("metrics/mAP50(B)", 0.0)), 4)
    map50_95 = round(float(val_metrics.results_dict.get("metrics/mAP50-95(B)", 0.0)), 4)

    print("\n==================================================")
    print("REAL VALIDATION METRICS:")
    print(f"  Precision: {precision}")
    print(f"  Recall:    {recall}")
    print(f"  mAP50:     {map50}")
    print(f"  mAP50-95:  {map50_95}")
    print("==================================================")

    # Supported classes from model
    classes_dict = val_model.names if hasattr(val_model, "names") else {}
    print("\nModel Classes:", classes_dict)

    # Per-class metrics if available
    per_class_metrics = {}
    try:
        if hasattr(val_metrics, "box") and hasattr(val_metrics.box, "maps"):
            for idx, map_val in enumerate(val_metrics.box.maps):
                c_name = classes_dict.get(idx, str(idx))
                per_class_metrics[c_name] = round(float(map_val), 4)
            print("\nPer-class mAP50-95:", per_class_metrics)
    except Exception as e:
        print(f"Could not extract per-class map: {e}")

    # Metadata storage
    metadata = {
        "model_name": "construction-ppe-yolo",
        "model_version": "v1",
        "base_model": base_checkpoint,
        "ultralytics_version": ultralytics.__version__,
        "dataset_name": "Construction-PPE (Ultralytics official)",
        "dataset_yaml": dataset_name,
        "classes": classes_dict,
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "training_device": device,
        "epochs": epochs,
        "image_size": imgsz,
        "training_duration_seconds": training_duration_sec,
        "metrics": {
            "precision": precision,
            "recall": recall,
            "mAP50": map50,
            "mAP50_95": map50_95,
            "per_class_mAP50_95": per_class_metrics
        },
        "license": "AGPL-3.0 (Dataset and YOLO default license)",
        "notes": "Trained with official Construction-PPE dataset. Note: dataset has 11 classes and does not have a no_vest class."
    }

    meta_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ai", "model_metadata.json")
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"\nSaved metadata to: {meta_file}")

    print("\n==================================================")
    print("TRAINING & VALIDATION PIPELINE COMPLETED SUCCESSFULLY!")
    print("==================================================")


if __name__ == "__main__":
    main()
